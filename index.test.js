
const fs = require('fs');
const request = require('./index');

(async () => {
  /**
   * - if path is specified, request returns undefined.
   * - if response headers contains application/json, we parse it
   * - if response headers contains text/plain, we return it
   * - if timeout is specified, and triggered
   */
  if (fs.existsSync('./env/tgBotToken.txt') === false) {
    throw Error('/env/tgBotToken.txt does not exist.');
  }
  if (fs.existsSync('./env/test.jpg') === false) {
    throw Error('/env/test.jpg does not exist.');
  }
  const tgBotToken = fs.readFileSync('./env/tgBotToken.txt', 'utf8');

  request({
    // large file 50mb
    // url: 'http://212.183.159.230/1MB.zip',

    // image/jpeg
    // url: 'http://i3.ytimg.com/vi/J---aiyznGQ/mqdefault.jpg',

    // application/json
    // url: 'https://jsonplaceholder.typicode.com/todos/1',

    // text/plain
    // url: 'https://stackoverflow.com/robots.txt',
    // dest: './a/b/test.jpg',

    // telegram request query
    // url: `https://api.telegram.org/bot${tgBotToken}/sendMessage`,
    // query: { chat_id: -1001471087738, text: 'request query' },

    // telegram request body, application/json
    // url: `https://api.telegram.org/bot${tgBotToken}/sendMessage`,
    // body: { chat_id: -1001471087738, text: 'request body, application/json😂' },
    // body: { chat_id: -1001471087738, text: 'test emojis 😂😎☺️😯😓😔😕' },

    // telegram request body, multipart/form-data
    // url: 'https://postman-echo.com/post',
    url: `https://api.telegram.org/bot${tgBotToken}/sendMessage`,
    // url: `https://api.telegram.org/bot${tgBotToken}/sendPhoto`,
    form: [
      { name: 'chat_id', data: '-1001471087738' },
      { name: 'text', data: 'request body, multipart/form-data' },
      // { name: 'photo', filename: 'photo.jpg', data: fs.readFileSync('./env/test.jpg') },
    ],

    timeout: 10000,
  })
    .then((result) => {
      console.log({ result });
      // console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error({ error });
    });
})();
