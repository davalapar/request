/* eslint-disable no-console, prefer-destructuring, no-continue */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const qs = require('querystring');
const crypto = require('crypto');

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
  let dest;
  if (config.dest !== undefined) {
    if (typeof config.dest !== 'string') {
      reject(new Error('invalid non-string config.dest'));
      return;
    }
    dest = config.dest;
  }
  const headers = {};
  let method = 'GET';
  if (config.body !== undefined && config.form !== undefined) {
    reject(new Error('invalid non-undefined config.body and non-undefined config.form'));
    return;
  }
  let body;
  if (config.body !== undefined) {
    if (typeof config.body !== 'object' || config.body === null) {
      reject(new Error('invalid non-object config.body'));
      return;
    }
    method = 'POST';
    body = JSON.stringify(config.body);
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
    (res) => {
      // console.log('res ::');
      const cType = res.headers['content-type'] || '';
      const cLength = Number(res.headers['content-length']) || Infinity;
      // console.log(res.statusCode);
      // console.log(res.headers);
      if (res.statusCode === 200 || cType.includes('application/json') === true) {
        if (dest === undefined) {
          if (timeout !== undefined) {
            clearTimeout(timeoutObject);
            timeoutObject = setTimeout(() => {
              // console.log('res :: timeout');
              req.abort();
              res.removeAllListeners();
              res.destroy();
              reject(new Error(`RES_TIMEOUT_${timeout}`));
            }, timeout);
          }
          let buffer = Buffer.alloc(0);
          res.on('data', (chunk) => {
            // console.log('res :: data', chunk.byteLength, buffer.byteLength, cLength, (buffer.byteLength / cLength) * 100);
            buffer = Buffer.concat([buffer, chunk]);
          });
          res.on('end', () => {
            // console.log('res :: end');
            if (timeout !== undefined) {
              clearTimeout(timeoutObject);
            }
            if (cType.includes('application/json') === true) {
              try {
                resolve(JSON.parse(buffer.toString('utf8')));
              } catch (e) {
                reject(e);
              }
            } else if (cType.includes('text/plain') === true || cType.includes('text/html') === true) {
              try {
                resolve(buffer.toString('utf8'));
              } catch (e) {
                reject(e);
              }
            } else {
              resolve(buffer);
            }
          });
        } else {
          const dir = path.dirname(dest);
          if (fs.existsSync(dir) === false) {
            fs.mkdirSync(dir, { recursive: true });
          }
          if (fs.existsSync(dest) === true) {
            fs.unlinkSync(dest);
          }
          const fws = fs.createWriteStream(dest, { flags: 'wx' });
          if (timeout !== undefined) {
            clearTimeout(timeoutObject);
            timeoutObject = setTimeout(() => {
              req.abort();
              res.removeAllListeners();
              res.destroy();
              fws.close();
              if (fs.existsSync(dest) === true) {
                fs.unlinkSync(dest);
              }
              reject(new Error(`RES_TIMEOUT_${timeout}`));
            }, timeout);
          }
          res.pipe(fws);
          fws.on('error', (e) => {
            // console.log('fws :: error');
            if (timeout !== undefined) {
              clearTimeout(timeoutObject);
            }
            req.abort();
            res.removeAllListeners();
            res.destroy();
            fws.close();
            if (fs.existsSync(dest) === true) {
              fs.unlinkSync(dest);
            }
            reject(e);
          });
          fws.on('finish', () => {
            // console.log('fws :: finish');
            if (timeout !== undefined) {
              clearTimeout(timeoutObject);
            }
            resolve(cLength);
          });
        }
      } else {
        if (timeout !== undefined) {
          clearTimeout(timeoutObject);
        }
        req.abort();
        res.removeAllListeners();
        res.destroy();
        reject(new Error(`RES_UNEXPECTED_${res.statusCode}`));
      }
    },
  );
  if (timeout !== undefined) {
    timeoutObject = setTimeout(() => {
      // console.log('req :: timeout');
      req.abort();
      reject(new Error(`REQ_TIMEOUT_${timeout}`));
    }, timeout);
  }
  req.on('error', (e) => {
    // console.log('req :: error');
    if (timeout !== undefined) {
      clearTimeout(timeoutObject);
    }
    reject(e);
  });
  if (method === 'POST') {
    if (body !== undefined) {
      req.write(body);
    }
    if (form !== undefined) {
      // console.log('---------');
      // form.forEach((item) => fs.appendFileSync('./dump.txt', item));
      // console.log('---------');
      for (let i = 0, l = form.length; i < l; i += 1) {
        req.write(form[i]);
      }
    }
  }
  req.end();
});

module.exports = request;
