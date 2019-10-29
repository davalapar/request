/* eslint-disable no-console, prefer-destructuring */

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
  }
  let url;
  let agent;
  if (config.url === undefined) {
    reject(new Error('invalid undefined config.url'));
  } else if (typeof config.url !== 'string') {
    reject(new Error('invalid non-string config.url'));
  } else {
    if (config.url.includes('https://') === true) {
      agent = https;
    } else if (config.url.includes('http://') === true) {
      agent = http;
    } else {
      reject(new Error('invalid non-http non-https protocols'));
    }
    url = new URL(config.url);
  }
  let query;
  if (config.query !== undefined) {
    if (typeof config.query !== 'object' || config.query === null) {
      reject(new Error('invalid non-object config.query'));
    } else if (url.search !== '') {
      reject(new Error('invalid non-empty url search and non-object config.query'));
    } else {
      query = qs.stringify(config.query);
    }
  }
  let dest;
  if (config.dest !== undefined) {
    if (typeof config.dest !== 'string') {
      reject(new Error('invalid non-string config.dest'));
    } else {
      dest = config.dest;
    }
  }
  const headers = {};
  let method = 'GET';
  if (config.body !== undefined && config.form !== undefined) {
    reject(new Error('invalid non-undefined config.body and non-undefined config.form'));
  }
  let body;
  if (config.body !== undefined) {
    if (typeof config.body !== 'object' || config.body === null) {
      reject(new Error('invalid non-object config.body'));
    } else {
      method = 'POST';
      body = JSON.stringify(config.body);
      headers['content-type'] = 'application/json';
      headers['content-length'] = body.length; // will produce error if body has non-ascii utf8
    }
  }
  let form;
  let boundary;
  if (config.form !== undefined) {
    if (Array.isArray(config.form) === false) {
      reject(new Error('invalid non-array config.form'));
    } else {
      method = 'POST';
      boundary = crypto.randomBytes(16).toString('hex');
      headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
      headers['transfer-encoding'] = 'chunked';
      headers['content-length'] = 0;
      form = config.form.map((item, index) => {
        let buffer;
        let data = '';
        if (index > 0) {
          data += '\r\n';
        }
        data += `--${boundary}`;
        if (item.name === undefined || typeof item.name !== 'string' || item.name === '') {
          reject(new Error(`invalid form[${index}].name`));
        } else if (item.filename !== undefined) {
          if (typeof item.filename !== 'string' || item.filename === '') {
            reject(new Error(`invalid form[${index}].filename`));
          } else {
            data += `content-disposition: form-data; name="${item.name}"; name="${item.filename}"`;
          }
        } else {
          data += `\r\ncontent-disposition: form-data; name="${item.name}"`;
        }
        if (item.type !== undefined) {
          if (typeof item.type !== 'string' || item.type === '') {
            reject(new Error(`invalid form[${index}].type`));
          } else {
            data += `\r\ncontent-type: ${item.type}`;
          }
        } else if (item.filename !== undefined) {
          const type = mime.lookup(item.filename);
          if (type !== false) {
            data += `\r\ncontent-type: ${type}`;
          }
        } else if (Buffer.isBuffer(item.data) === true) {
          data += '\r\ncontent-type: application/octet-stream';
        }
        data += '\r\n';
        if (item.data === undefined) {
          reject(new Error(`invalid undefined form[${index}].data`));
        } else if (typeof data === 'string') {
          data += `\r\n${item.data}`;
          if (index === config.form.length - 1) {
            data += `\r\n--${boundary}--`;
          }
          buffer = Buffer.from(data);
          headers['content-length'] += buffer.byteLength;
          return buffer;
        } else if (Buffer.isBuffer(item.data) === true) {
          buffer = Buffer.concat([Buffer.from(data), item.data]);
          headers['content-length'] += buffer.byteLength;
          return buffer;
        } else {
          reject(new Error(`invalid non-string non-buffer form[${index}].data`));
        }
        return undefined;
      });
    }
  }
  let timeout;
  if (config.timeout !== undefined) {
    if (typeof config.timeout !== 'number') {
      reject(new Error('invalid non-number config.timeout'));
    } else if (Number.isNaN(config.timeout) === true) {
      reject(new Error('invalid NaN config.timeout'));
    } else if (Number.isFinite(config.timeout) === false) {
      reject(new Error('invalid non-finite config.timeout'));
    } else {
      timeout = config.timeout;
    }
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
      // form.forEach((item) => console.log(item.toString('utf8')));
      // console.log('---------');
      for (let i = 0, l = form.length; i < l; i += 1) {
        req.write(form[i]);
      }
    }
  }
  req.end();
});

module.exports = request;
