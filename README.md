
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

    // required String
    url: 'https://...',

    // optional Object
    query: {},

    // optional Boolean
    json: true,

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

- request `query` parameter
  - for search / query parameters such as `?foo=bar`
  - works with request `body` or `form` parameters
  - works for `GET` and `POST` methods
- request `json` parameter
  - allows JSON-parsing of response
  - sets `accept: application/json`
  - ignored if `destination` parameter exists
- request `body` parameter
  - sets `accept: application/json`
  - sets `content-type: application/json`
  - accepts non-ascii utf8 strings, emojis
  - works with request query parameter
  - does not work with request `form` parameter
  - uses `POST` method
- request `form` parameter
  - sets `content-type: multipart/form-data`
  - accepts utf8 strings & binary data
  - works with request query parameter
  - does not work with request `body` parameter
  - uses `POST` method
- request decompression
  - sets `accept-encoding: 'br, gzip, deflate`
  - accepts `content-encoding: br/gzip/deflate`
- request `destination` parameter
  - file destination path
  - also creates parent directories
- request `timeout`
  - request timeout in ms
- request `maxSize`
  - response max size in bytes
- throws `error` on non-200 responses
- non-200 response data as `error.data`
- throws `error` on response data parsing error
- return `content-type: application/json` as `Object`
- return `content-type: text/plain` as `String`
- return `content-type: text/html` as `String`
- return everything else as `Buffer`, if `destination` not provided

#### License

MIT | @davalapar