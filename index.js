/* eslint-disable no-console, prefer-destructuring */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const qs = require('querystring');

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
  let method = 'GET';
  let body;
  const headers = {};
  if (config.body !== undefined) {
    if (typeof config.body !== 'object' || config.body === null) {
      reject(new Error('invalid non-object config.body'));
    } else {
      method = 'POST';
      body = JSON.stringify(config.body);
      headers['content-type'] = 'application/json';
      headers['content-length'] = body.length;
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

  // console.log({ url, pathname, body });

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
      const cType = res.headers['content-type'];
      const cLength = Number(res.headers['content-length']);
      // if (Number.isNaN(cLength) === true) {
      //   reject(new Error('RES_CLENGTH_NAN'));
      // }
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
            } else if (cType.includes('text/plain') === true) {
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
    req.write(body);
  }
  req.end();
});

module.exports = request;
