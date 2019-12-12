/* eslint-disable no-console, prefer-destructuring, no-continue */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const qs = require('querystring');
const crypto = require('crypto');
const zlib = require('zlib');
const stream = require('stream');
const dns = require('dns');

const mime = require('mime-types');

const destCompatibleStatusCodes = [200, 201, 204];

const validateObjectForJSON = (value) => {
  switch (typeof value) {
    case 'string':
    case 'boolean':
    case 'undefined': {
      return true;
    }
    case 'number': {
      if (Number.isNaN(value) === true || Number.isFinite(value) === false) {
        return false;
      }
      return true;
    }
    case 'object': {
      if (value === null) {
        return true;
      }
      if (Array.isArray(value) === true) {
        for (let i = 0, l = value.length; i < l; i += 1) {
          if (validateObjectForJSON(value[i]) === false) {
            return false;
          }
        }
        return true;
      }
      const keys = Object.keys(value);
      for (let i = 0, l = keys.length; i < l; i += 1) {
        if (validateObjectForJSON(value[keys[i]]) === false) {
          return false;
        }
      }
      return true;
    }
    default: {
      return false;
    }
  }
};

const dnsCache = new Map();

const lookup = (hostname, options, callback) => {
  if (dnsCache.has(hostname) === true) {
    const [address, family, ttlInMs, timestamp] = dnsCache.get(hostname);
    if (Date.now() - timestamp < timestamp + ttlInMs) {
      callback(null, address, family);
      return;
    }
    dnsCache.delete(hostname);
  }
  dns.resolve4(hostname, { ttl: true }, (error4, addresses4) => {
    if (error4 !== null) {
      dns.resolve6(hostname, { ttl: true }, (error6, addresses6) => {
        if (error6 !== null) {
          callback(error6);
          return;
        }
        if (Array.isArray(addresses6) === true && typeof addresses6[0] === 'object' && addresses6[0] !== null) {
          const { address, ttl } = addresses6[0];
          const ttlInMs = ttl * 1000;
          const family = 6;
          const timestamp = Date.now();
          dnsCache.set(hostname, [address, family, ttlInMs, timestamp]);
          callback(null, address, family);
        }
      });
      return;
    }
    if (Array.isArray(addresses4) === true && typeof addresses4[0] === 'object' && addresses4[0] !== null) {
      const { address, ttl } = addresses4[0];
      const ttlInMs = ttl * 1000;
      const family = 4;
      const timestamp = Date.now();
      dnsCache.set(hostname, [address, family, ttlInMs, timestamp]);
      callback(null, address, family);
    }
  });
};

const request = (config) => new Promise((resolve, reject) => {
  try {
    if (typeof config !== 'object' || config === null) {
      throw Error('invalid non-object config');
    }
    let agent;
    if (config.url === undefined) {
      throw Error('invalid undefined config.url');
    }
    if (typeof config.url !== 'string') {
      throw Error('invalid non-string config.url');
    }
    if (config.url.substring(0, 8) === 'https://') {
      agent = https;
    } else if (config.url.substring(0, 7) === 'http://') {
      agent = http;
    } else {
      throw Error('invalid non-http non-https protocols');
    }
    const url = new URL(config.url);
    let query;
    if (config.query !== undefined) {
      if (typeof config.query !== 'object' || config.query === null) {
        throw Error('invalid non-object config.query');
      }
      if (url.search !== '') {
        throw Error('invalid non-empty url search and non-object config.query');
      }
      query = qs.stringify(config.query);
    }
    let onProgress;
    if (config.onProgress !== undefined) {
      if (typeof config.onProgress !== 'function') {
        throw Error('invalid non-function config.onProgress');
      }
      onProgress = config.onProgress;
    }
    let destination;
    if (config.destination !== undefined) {
      if (typeof config.destination !== 'string') {
        throw Error('invalid non-string config.destination');
      }
      if (config.text !== undefined) {
        throw Error('invalid non-undefined config.text and non-undefined config.destination');
      }
      if (config.json !== undefined) {
        throw Error('invalid non-undefined config.json and non-undefined config.destination');
      }
      destination = config.destination;
    }
    const headers = {};
    if (config.headers !== undefined) {
      if (typeof config.headers !== 'object' || config.headers === null) {
        throw Error('invalid non-object / null config.headers');
      }
      Object.assign(headers, config.headers);
    }
    if (config.auth !== undefined) {
      if (typeof config.auth !== 'string' || config.auth === '') {
        throw Error('invalid non-string / empty-string config.auth');
      }
      headers.authorization = config.auth;
    }
    if (config.authorization !== undefined) {
      if (typeof config.authorization !== 'string' || config.authorization === '') {
        throw Error('invalid non-string / empty-string config.authorization');
      }
      headers.authorization = config.authorization;
    }
    if (config.userAgent !== undefined) {
      if (typeof config.userAgent !== 'string' || config.userAgent === '') {
        throw Error('invalid non-string / empty-string config.userAgent');
      }
      headers['user-agent'] = config.userAgent;
    }
    if (config.referer !== undefined) {
      if (typeof config.referer !== 'string' || config.referer === '') {
        throw Error('invalid non-string / empty-string config.referer');
      }
      headers.referer = config.referer;
    }
    if (config.referrer !== undefined) {
      if (typeof config.referrer !== 'string' || config.referrer === '') {
        throw Error('invalid non-string / empty-string config.referrer');
      }
      headers.referer = config.referrer;
    }
    if (config.text !== undefined && config.json !== undefined) {
      throw Error('invalid non-undefined config.text and non-undefined config.json');
    }
    let text;
    if (config.text !== undefined) {
      if (typeof config.text !== 'boolean') {
        throw Error('invalid non-boolean config.text');
      }
      text = true;
      headers.accept = 'text/*';
    }
    let json;
    if (config.json !== undefined) {
      if (typeof config.json !== 'boolean') {
        throw Error('invalid non-boolean config.json');
      }
      json = true;
      headers.accept = 'application/json';
    }
    if (config.body !== undefined && config.form !== undefined) {
      throw Error('invalid non-undefined config.body and non-undefined config.form');
    }
    let method = 'GET';
    let body;
    if (config.body !== undefined) {
      if (typeof config.body !== 'object' || config.body === null) {
        throw Error('invalid non-object config.body');
      }
      if (validateObjectForJSON(config.body) === false) {
        throw Error('invalid config.body value, validateObjectForJSON');
      }
      method = 'POST';
      body = JSON.stringify(config.body);
      json = true;
      headers.accept = 'application/json';
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.from(body).byteLength;
    }
    let form;
    if (config.form !== undefined) {
      if (Array.isArray(config.form) === false) {
        throw Error('invalid non-array config.form');
      }
      for (let i = 0, l = config.form.length; i < l; i += 1) {
        const item = config.form[i];
        if (typeof item.name !== 'string' || item.name === '') {
          throw Error(`invalid non-string/empty-string config.form[${i}].name`);
        }
        if (item.filename !== undefined && (typeof item.filename !== 'string' || item.filename === '')) {
          throw Error(`invalid defined non-string/empty-string config.form[${i}].filename`);
        }
        if (typeof item.data !== 'string' && Buffer.isBuffer(item.data) === false) {
          if (item.filename !== undefined) {
            throw Error(`invalid defined filename with non-string & non-buffer config.form[${i}].data`);
          }
          if (validateObjectForJSON(item.data) === false) {
            throw Error(`invalid config.form[${i}].data, validateObjectForJSON`);
          }
        }
      }
      method = 'POST';
      const boundary = crypto.randomBytes(32).toString('hex');
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
        data += `\r\ncontent-disposition: form-data; name="${item.name}"`;

        // string, buffer, with filename
        if (item.filename !== undefined) {
          data += `; filename="${item.filename}"`;
          if (typeof item.data === 'string' || Buffer.isBuffer(item.data) === true) {
            const type = mime.lookup(item.filename);
            if (type !== false) {
              data += `\r\ncontent-type: ${type}`;
            } else if (Buffer.isBuffer(item.data) === true) {
              data += '\r\ncontent-type: application/octet-stream';
            }
          }

        // application/octet-stream compatible data:
        // buffers
        } else if (Buffer.isBuffer(item.data) === true) {
          data += '\r\ncontent-type: application/octet-stream';

        // application/json compatible data:
        // number, boolean, undefined, null, plain array, plain objects
        } else if (typeof item.data !== 'string') {
          data += '\r\ncontent-type: application/json';
        }

        // data:
        let buffer;

        // strings
        if (typeof item.data === 'string') {
          if (i === config.form.length - 1) {
            buffer = Buffer.from(`${data}\r\n\r\n${item.data}\r\n--${boundary}--`);
          } else {
            buffer = Buffer.from(`${data}\r\n\r\n${item.data}`);
          }

        // buffers
        } else if (Buffer.isBuffer(item.data) === true) {
          if (i === config.form.length - 1) {
            buffer = Buffer.concat([Buffer.from(`${data}\r\n\r\n`), item.data, Buffer.from(`\r\n--${boundary}--`)]);
          } else {
            buffer = Buffer.concat([Buffer.from(`${data}\r\n\r\n`), item.data]);
          }

        // non-NaN finite numbers, booleans
        // undefined, null, plain arrays, plain objects
        } else if (i === config.form.length - 1) {
          buffer = Buffer.from(`${data}\r\n\r\n${JSON.stringify(item.data)}\r\n--${boundary}--`);
        } else {
          buffer = Buffer.from(`${data}\r\n\r\n${JSON.stringify(item.data)}`);
        }

        headers['content-length'] += buffer.byteLength;
        form[i] = buffer;
      }
    }
    let compression;
    if (config.compression !== undefined) {
      if (typeof config.compression !== 'boolean') {
        throw Error('invalid non-boolean config.compression');
      }
      compression = true;
      headers['accept-encoding'] = 'br, gzip, deflate';
    }
    let timeout;
    let timeoutStart;
    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number') {
        throw Error('invalid non-number config.timeout');
      }
      if (Number.isNaN(config.timeout) === true) {
        throw Error('invalid NaN config.timeout');
      }
      if (Number.isFinite(config.timeout) === false) {
        throw Error('invalid non-finite config.timeout');
      }
      if (Math.floor(config.timeout) !== config.timeout) {
        throw Error('invalid non-integer config.timeout');
      }
      timeout = config.timeout;
      timeoutStart = Date.now();
    }
    let maxSize;
    if (config.maxSize !== undefined) {
      if (typeof config.maxSize !== 'number') {
        throw Error('invalid non-number config.maxSize');
      }
      if (Number.isNaN(config.maxSize) === true) {
        throw Error('invalid NaN config.maxSize');
      }
      if (Number.isFinite(config.maxSize) === false) {
        throw Error('invalid non-finite config.maxSize');
      }
      if (Math.floor(config.maxSize) !== config.maxSize) {
        throw Error('invalid non-integer config.maxSize');
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
        lookup,
      },
      (response) => {
        // console.log(response.statusCode);
        // console.log(response.headers);

        if (timeout !== undefined) {
          clearTimeout(timeoutObject);
          timeoutObject = undefined;
        }

        const hContentType = response.headers['content-type'] || '';
        const hContentEncoding = response.headers['content-encoding'] || '';
        const hContentLength = Number(response.headers['content-length']) || Infinity;

        let responseStream;

        let rContentLength; // received raw content length

        if (Number.isFinite(hContentLength) === true) {
          if (maxSize !== undefined) {
            if (hContentLength > maxSize) {
              req.abort();
              response.removeAllListeners();
              response.destroy();
              reject(Error(`RES_MAXSIZE_EXCEEDED_${maxSize}_BYTES`));
              return;
            }
          }
          rContentLength = 0;
          responseStream = response.pipe(new stream.Transform({
            transform(chunk, encoding, callback) {
              rContentLength += chunk.byteLength;
              if (onProgress !== undefined) {
                onProgress(chunk.byteLength, rContentLength, hContentLength);
              }
              this.push(chunk);
              callback();
            },
          }));
        } else {
          responseStream = response;
        }
        if (compression === true) {
          switch (hContentEncoding) {
            case 'br': {
              responseStream = responseStream.pipe(zlib.createBrotliDecompress());
              break;
            }
            case 'gzip': {
              responseStream = responseStream.pipe(zlib.createGunzip());
              break;
            }
            case 'deflate': {
              responseStream = responseStream.pipe(zlib.createInflate());
              break;
            }
            default: {
              break;
            }
          }
        }

        if (destCompatibleStatusCodes.includes(response.statusCode) === true && destination !== undefined) {
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
              reject(Error(`RES_TIMEOUT_${timeout}_MS`));
            }, timeout - (Date.now() - timeoutStart));
          }
          responseStream.pipe(fws);
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
            req.abort();
            response.removeAllListeners();
            response.destroy();
            reject(Error(`RES_TIMEOUT_${timeout}_MS`));
          }, timeout - (Date.now() - timeoutStart));
        }

        let buffer;
        responseStream.on('data', (chunk) => {
          buffer = buffer === undefined ? chunk : Buffer.concat([buffer, chunk]);
        });
        responseStream.on('end', () => {
          if (timeout !== undefined) {
            clearTimeout(timeoutObject);
          }
          let data;
          let error;
          if (rContentLength !== undefined && rContentLength !== hContentLength) {
            error = Error(`RES_CONTENT_LENGTH_MISMATCH_${hContentLength}_${rContentLength}`);
          }
          switch (response.statusCode) {
            case 200: // ok
            case 201: // created
            case 204: { // no content
              break;
            }
            case 301: // moved permanently
            case 302: // found
            case 307: // temporary redirect
            case 308: { // permanent redirect
              const hLocation = response.headers.location || '';
              if (hLocation === '') {
                error = Error(`RES_UNEXPECTED_${response.statusCode}_WITHOUT_LOCATION`);
              } else {
                req.abort();
                response.removeAllListeners();
                response.destroy();
                request({ ...config, url: hLocation })
                  .then(resolve)
                  .catch(reject);
                return;
              }
              break;
            }
            default: {
              error = Error(`RES_UNEXPECTED_${response.statusCode}`);
              break;
            }
          }
          if (buffer !== undefined) {
            if (json === true && hContentType.includes('application/json') === true) {
              try {
                data = JSON.parse(buffer.toString('utf8'));
              } catch (e) {
                error = e;
              }
            } else if (text === true && hContentType.includes('text/') === true) {
              try {
                data = buffer.toString('utf8');
              } catch (e) {
                error = e;
              }
            } else {
              data = buffer;
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
        reject(Error(`REQ_TIMEOUT_${timeout}_MS`));
      }, timeout - (Date.now() - timeoutStart));
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
        } else if (form !== undefined) {
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
  } catch (e) {
    reject(e);
  }
});

request.dnsCache = dnsCache;

module.exports = request;
