
## @davalapar/request

#### Usage

```js
const request = require('@davalapar/request');

(async () => {
  const response = await request({
    // required string
    // must include 'http://' or 'https://'
    url: 'https://...',

    // optional object, request query
    // search parameters
    query: {},

    // optional object, request body,
    // sets content-type to application/json
    // sets content-length
    // sets method to POST
    body: {},

    // optional array, request form data,
    // sets content-type to multipart/form-data
    // transfer-encoding
    // sets content-length
    // sets method to POST
    form: [
      {
        name: '', // required string
        filename: '', // optional string
        type: '', // optional string
        data: '', // required string or buffer
      }
    ],

    // optional string, save destination path
    // if not set, response will be a buffer
    dest: './dir/filename.ext',

    // optional number, timeout in ms
    // will abort request & destroy response
    timeout: 30000,
  });
})();
```

- request query
  - from `config.query` if set
  - from `config.url` if set
- request body
  - from `config.body` if set
- request method
  - `POST` if `config.body` is set
  - `GET` if `config.body` not set
- response
  - object if header `content-type` includes `application/json`
  - string if header `content-type` includes `text/plain`
  - buffer if `config.dest` not set
  - undefined if `config.dest` is set

#### License

MIT | @davalapar