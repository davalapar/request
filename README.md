
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
    // required string
    // must include 'http://' or 'https://'
    url: 'https://...',

    // optional object, request query
    // search parameters
    // WHEN TO USE: simple search queries
    query: {},

    // optional object, request body,
    // sets content-type to application/json
    // sets content-length
    // sets method to POST
    // WHEN TO USE: sending JSON-compatible data
    body: {},

    // optional array, request form data,
    // sets content-type to multipart/form-data
    // transfer-encoding
    // sets content-length
    // sets method to POST
    // WHEN TO USE: sending non-ascii data, binary data, files
    form: [
      {

        // required string
        // name of field
        name: '',

        // optional string,
        // recommended if data is buffer,
        // helps in correct mime-type lookup
        filename: '',

        // required string or buffer
        // the data itself
        data: '',
      }
    ],

    // optional string, save destination path
    // if not set, response will be a buffer
    destination: './dir/filename.ext',

    // optional number, timeout in ms
    // will abort request & destroy response
    timeout: 30000,

    // optional number,
    // max size in bytes
    // must be an integer
    maxSize: 1000,
  });
})();
```

#### Highlights

- request query parameters
  - accepts parameters such as `?foo=bar`
  - works for `GET` and `POST` methods
- request body parameters
  - sets `content-type: application/json`
  - accepts non-ascii utf8 strings, emojis
  - works with request query parameters
  - uses `POST` method
- request form parameters
  - sets `content-type: multipart/form-data`
  - accepts utf8 strings & binary data
  - works with request query parameters
  - uses `POST` method
- request decompression
  - sets `accept-encoding: 'br, gzip, deflate`
  - accepts `content-encoding: br/gzip/deflate`
- request `timeout` in ms
- request `maxSize` in bytes
- throws `error` on non-200 responses
- non-200 response data as `error.data`
- throws `error` on response data parsing error
- return `content-type=application/json` as `Object`
- return `content-type=text/plain` as `String`
- return `content-type=text/html` as `String`
- return everything else as `Buffer`, if `destination` not provided

#### License

MIT | @davalapar