
## @davalapar/request

server-side requests made ez

#### Usage

```sh
yarn add @davalapar/request
```

```js
const request = require('@davalapar/request');

(async () => {
  const response = await request({

    // optiona String
    userAgent: '',

    // required String
    url: 'https://...',

    // optional Object
    query: {},

    // optional Boolean
    text: true,

    // optional Boolean
    json: true,

    // optional Boolean
    compression: true,

    // optional Object
    body: {},

    // optional Array
    form: [
      {

        // required String
        name: 'photo',

        // optional String
        filename: 'photo.jpg',

        // required String or Buffer
        data: '',
      }
    ],

    // optional String
    destination: './dir/filename.ext',

    // optional Number
    timeout: 30000,

    // optional Number
    maxSize: 1000,
  });
})();
```

#### Highlights

- request `userAgent` parameter
  - sets `user-agent: userAgent`
- request `query` parameter
  - for search / query parameters such as `?foo=bar`
  - compatible with: `body`, `form`
- request `text` parameter
  - sets `accept: text/*`
  - parse response into `String` if `content-type: text/*`
  - incompatible with: `json`, `destination`
- request `json` parameter
  - sets `accept: application/json`
  - parse response into `Object` if `content-type: application/json`
  - incompatible with: `text`, `destination`
- request `body` parameter
  - sets `method: POST`
  - sets `accept: application/json`
  - sets `content-type: application/json`
  - accepts non-ascii utf8 strings, emojis
  - incompatible with: `form`
  - uses `POST` method
- request `form` parameter
  - sets `method: POST`
  - sets `content-type: multipart/form-data`
  - accepts utf8 strings,  binary data
  - incompatible with: `body`
- request `destination` parameter
  - file destination path
  - creates parent directories
  - incompatible with: `text`, `json`
- request `timeout` parameter
  - request timeout in ms
- request `maxSize` parameter
  - response max size in bytes
- request `compression` parameter
  - sets `accept-encoding: br, gzip, deflate`
  - accepts `content-encoding: br/gzip/deflate`
- built-ins
  - rejects with `error` on response data `json` parsing error
  - rejects with `error` on non-200 responses
  - non-200 response data as `error.data`
  - if `text` & `json` parameter not set, returns `Buffer`
  - verification of `content-length` if exists, for both compressed & non-compressed responses

#### License

MIT | @davalapar