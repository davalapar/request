/* eslint-disable no-console, prefer-destructuring, no-continue */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const qs = require('querystring');
const crypto = require('crypto');
const zlib = require('zlib');

const mime = require('mime-types');

const request = (config) => new Promise((resolve, reject) => {
  if (typeof config !== 'object' || config === null) {
    reject(new Error('invalid non-object config'));
    return;
  }
  let agent;
  if (config.url === undefined) {
    reject(new Error('invalid undefined config.url'));
    return;
  }
  if (typeof config.url !== 'string') {
    reject(new Error('invalid non-string config.url'));
    return;
  }
  if (config.url.includes('https://') === true) {
    agent = https;
  } else if (config.url.includes('http://') === true) {
    agent = http;
  } else {
    reject(new Error('invalid non-http non-https protocols'));
    return;
  }
  const url = new URL(config.url);
  let query;
  if (config.query !== undefined) {
    if (typeof config.query !== 'object' || config.query === null) {
      reject(new Error('invalid non-object config.query'));
      return;
    }
    if (url.search !== '') {
      reject(new Error('invalid non-empty url search and non-object config.query'));
      return;
    }
    query = qs.stringify(config.query);
  }
  let destination;
  if (config.destination !== undefined) {
    if (typeof config.destination !== 'string') {
      reject(new Error('invalid non-string config.destination'));
      return;
    }
    destination = config.destination;
  }
  const headers = {
    'accept-encoding': 'br, gzip, deflate',
  };
  let method = 'GET';
  if (config.body !== undefined && config.form !== undefined) {
    reject(new Error('invalid non-undefined config.body and non-undefined config.form'));
    return;
  }
  let json;
  if (config.json !== undefined) {
    if (typeof config.json !== 'boolean') {
      reject(new Error('invalid non-boolean config.json'));
      return;
    }
    json = true;
    headers.accept = 'application/json';
  }
  let body;
  if (config.body !== undefined) {
    if (typeof config.body !== 'object' || config.body === null) {
      reject(new Error('invalid non-object config.body'));
      return;
    }
    method = 'POST';
    body = JSON.stringify(config.body);
    json = true;
    headers.accept = 'application/json';
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.from(body).byteLength;
  }
  let form;
  let boundary;
  if (config.form !== undefined) {
    if (Array.isArray(config.form) === false) {
      reject(new Error('invalid non-array config.form'));
      return;
    }
    method = 'POST';
    boundary = crypto.randomBytes(16).toString('hex');
    headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
    headers['content-length'] = 0;
    form = new Array(config.form.length);
    for (let i = 0, l = config.form.length; i < l; i += 1) {
      const item = config.form[i];
      let data = '';

      // boundary:
      if (i > 0) {
        data += '\r\n';
      }
      data += `--${boundary}`;

      // content disposition:
      if (item.name === undefined || typeof item.name !== 'string' || item.name === '') {
        reject(new Error(`invalid form[${i}].name`));
        return;
      }
      data += `\r\ncontent-disposition: form-data; name="${item.name}"`;
      if (item.filename !== undefined) {
        if (typeof item.filename !== 'string' || item.filename === '') {
          reject(new Error(`invalid form[${i}].filename`));
          return;
        }
        data += `; filename="${item.filename}"`;
      } else if (Buffer.isBuffer(item.data) === true) {
        data += `; filename="${item.name}"`;
      }

      // content type:
      if (item.filename !== undefined) {
        const type = mime.lookup(item.filename);
        if (type !== false) {
          data += `\r\ncontent-type: ${type}`;
        }
      } else if (Buffer.isBuffer(item.data) === true) {
        data += '\r\ncontent-type: application/octet-stream';
      }

      // data:
      data += '\r\n';
      if (item.data === undefined) {
        reject(new Error(`invalid undefined form[${i}].data`));
        return;
      }

      if (typeof item.data === 'string') {
        data += `\r\n${item.data}`;
        if (i === config.form.length - 1) {
          data += `\r\n--${boundary}--`;
        }
        const buffer = Buffer.from(data);
        headers['content-length'] += buffer.byteLength;
        form[i] = buffer;
        continue;
      }
      if (Buffer.isBuffer(item.data) === true) {
        data += '\r\n';
        const buffer = Buffer.concat([
          Buffer.from(data),
          item.data,
          Buffer.from(`\r\n--${boundary}--`),
        ]);
        headers['content-length'] += buffer.byteLength;
        form[i] = buffer;
        continue;
      }
      reject(new Error(`invalid non-string non-buffer form[${i}].data`));
      return;
    }
  }
  let timeout;
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number') {
      reject(new Error('invalid non-number config.timeout'));
      return;
    }
    if (Number.isNaN(config.timeout) === true) {
      reject(new Error('invalid NaN config.timeout'));
      return;
    }
    if (Number.isFinite(config.timeout) === false) {
      reject(new Error('invalid non-finite config.timeout'));
      return;
    }
    timeout = config.timeout;
  }
  let maxSize = Infinity;
  if (config.maxSize !== undefined) {
    if (typeof config.maxSize !== 'number') {
      reject(new Error('invalid non-number config.maxSize'));
      return;
    }
    if (Number.isNaN(config.maxSize) === true) {
      reject(new Error('invalid NaN config.maxSize'));
      return;
    }
    if (Number.isFinite(config.maxSize) === false) {
      reject(new Error('invalid non-finite config.maxSize'));
      return;
    }
    if (Math.floor(config.maxSize) !== config.maxSize) {
      reject(new Error('invalid non-integer config.maxSize'));
      return;
    }
    maxSize = config.maxSize;
  }

  let timeoutObject;

  let pathname = url.pathname;
  if (url.search !== '') {
    pathname += url.search;
  } else if (query !== undefined) {
    pathname += `?${query}`;
  }

  /*
  console.log({
    method,
    url,
    pathname,
    body,
    form,
    headers,
  });
  */

  const req = agent.request(
    {
      method,
      headers,
      protocol: url.protocol,
      host: url.hostname,
      path: pathname,
      port: url.port,
    },
    (response) => {
      if (timeout !== undefined) {
        clearTimeout(timeoutObject);
        timeoutObject = undefined;
      }
      const cType = response.headers['content-type'] || '';
      const cEncoding = response.headers['content-encoding'] || '';
      const cLength = Number(response.headers['content-length']) || Infinity;
      if (Number.isFinite(cLength) === true && Number.isFinite(maxSize) === true) {
        if (cLength > 1) {
          req.abort();
          response.removeAllListeners();
          response.destroy();
          reject(new Error(`RES_MAXSIZE_EXCEEDED_${maxSize}_BYTES`));
          return;
        }
      }
      // console.log(response.statusCode);
      // console.log(response.headers);
      if (response.statusCode === 200 && destination !== undefined) {
        const dir = path.dirname(destination);
        if (fs.existsSync(dir) === false) {
          fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(destination) === true) {
          fs.unlinkSync(destination);
        }
        const fws = fs.createWriteStream(destination, { flags: 'wx' });
        if (timeout !== undefined) {
          timeoutObject = setTimeout(() => {
            req.abort();
            response.removeAllListeners();
            response.destroy();
            fws.close();
            if (fs.existsSync(destination) === true) {
              fs.unlinkSync(destination);
            }
            reject(new Error(`RES_TIMEOUT_${timeout}_MS`));
          }, timeout);
        }
        switch (cEncoding) {
          case 'br': {
            response.pipe(zlib.createBrotliDecompress()).pipe(fws);
            break;
          }
          case 'gzip': {
            response.pipe(zlib.createGunzip()).pipe(fws);
            break;
          }
          case 'deflate': {
            response.pipe(zlib.createInflate()).pipe(fws);
            break;
          }
          default: {
            response.pipe(fws);
            break;
          }
        }
        fws.on('error', (e) => {
          if (timeout !== undefined) {
            clearTimeout(timeoutObject);
          }
          req.abort();
          response.removeAllListeners();
          response.destroy();
          fws.close();
          if (fs.existsSync(destination) === true) {
            fs.unlinkSync(destination);
          }
          reject(e);
        });
        fws.on('finish', () => {
          if (timeout !== undefined) {
            clearTimeout(timeoutObject);
          }
          resolve();
        });
        return;
      }
      if (timeout !== undefined) {
        timeoutObject = setTimeout(() => {
          // console.log('response :: timeout');
          req.abort();
          response.removeAllListeners();
          response.destroy();
          reject(new Error(`RES_TIMEOUT_${timeout}_MS`));
        }, timeout);
      }
      let stream;
      switch (cEncoding) {
        case 'br': {
          stream = response.pipe(zlib.createBrotliDecompress());
          break;
        }
        case 'gzip': {
          stream = response.pipe(zlib.createGunzip());
          break;
        }
        case 'deflate': {
          stream = response.pipe(zlib.createInflate());
          break;
        }
        default: {
          stream = response;
          break;
        }
      }
      let buffer;
      stream.on('data', (chunk) => {
        buffer = buffer === undefined ? chunk : Buffer.concat([buffer, chunk]);
      });
      stream.on('end', () => {
        if (timeout !== undefined) {
          clearTimeout(timeoutObject);
        }
        let data;
        let error;
        if (response.statusCode !== 200) {
          error = new Error(`RES_UNEXPECTED_${response.statusCode}`);
        }
        if (json === true && cType.includes('application/json') === true) {
          if (buffer !== undefined) {
            try {
              data = JSON.parse(buffer.toString('utf8'));
            } catch (e) {
              error = e;
            }
          }
        } else if (cType.includes('text/plain') === true || cType.includes('text/html') === true) {
          if (buffer !== undefined) {
            try {
              data = buffer.toString('utf8');
            } catch (e) {
              error = e;
            }
          }
        }
        if (error === undefined) {
          resolve(data);
        } else {
          error.data = data;
          reject(error);
        }
      });
    },
  );
  if (timeout !== undefined) {
    timeoutObject = setTimeout(() => {
      req.abort();
      reject(new Error(`REQ_TIMEOUT_${timeout}_MS`));
    }, timeout);
  }
  req.on('error', (e) => {
    if (timeout !== undefined) {
      clearTimeout(timeoutObject);
    }
    reject(e);
  });
  try {
    if (method === 'POST') {
      if (body !== undefined) {
        req.write(body);
      }
      if (form !== undefined) {
        // form.forEach((item) => fs.appendFileSync('./dump.txt', item));
        for (let i = 0, l = form.length; i < l; i += 1) {
          req.write(form[i]);
        }
      }
    }
    req.end();
  } catch (e) {
    req.abort();
    reject(e);
  }
});

module.exports = request;
