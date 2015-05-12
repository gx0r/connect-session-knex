### Usage

With Express 3:

```js
var express = require('express')
var KnexSessionStore = require('connect-session-knex')(express);
var store = new KnexSessionStore(/* options here */);

app.configure(function() {
  app.use(express.session({
    store: store,
    secret: 'your secret',
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
  }));
});
```

With Connect:

```js
var connect = require('connect'),
var KnexSessionStore = require('connect-session-knex')(connect);
var store = new KnexSessionStore(/* options here */);

connect.createServer(
  connect.cookieParser(),
  connect.session({
    store: store,
    secret: 'your secret'
  })
);
```
