
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
- request form
  - from `config.form` if set
- response
  - `Object` if header `content-type` includes `application/json`
  - `String` if header `content-type` includes `text/plain`or `text/html`
  - `Buffer` if `config.dest` not set
  - `undefined` if `config.dest` is set

#### License

MIT | @davalapar