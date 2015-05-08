# Connect Session Knex


[![NPM Version][npm-version-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
[![Node.js Version][node-image]][node-url]
[![Build Status][travis-image]][travis-url]
[![Dependency Status][dependencies-image]][dependencies-url]
[![Coverage Status][coveralls-image]][coveralls-url]

[![NPM][npm-image]][npm-url]

[![Build Status](https://travis-ci.org/llambda/connect-session-knex.svg?branch=master)](https://travis-ci.org/llambda/connect-session-knex)

connect-session-knex is an [express-session](https://github.com/expressjs/session) store backed by Postgres, MySQL, MariaDB or SQLite3, via the [knex.js](http://knexjs.org/) library.

## Installation

```sh
$ npm install connect-session-knex
```

## Usage

With express 4.x and the default sqlite3 DB:

```js
var session = require('express-session');
var KnexSessionStore = require('connect-session-knex')(session);
var store = new KnexSessionStore(/* options here */);

app.use(session({
  store: store,
  secret: 'your secret',
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
}));
```

With express 4.x and PostgreSQL:

```js
var session = require('express-session');
var KnexSessionStore = require('connect-session-knex')(session);
var knexPg = require('knex')({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: '',
    database: 'travis_ci_test'
  }
});
var store = new KnexSessionStore({
  knex: knexPg,
  tablename: 'sessions'
});

app.use(session({
  store: store,
  secret: 'your secret',
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
}));
```


With express 3.x:

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

With connect:

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

## Options

 - `tablename='sessions'` Tablename to use. Defaults to 'sessions'.
 - `knex` knex instance to use. Defaults to a new knex instance, using sqlite3 with a file named 'connect-session-knex.sqlite'


## Benchmarks

https://github.com/llambda/express-session-benchmarks

[npm-version-image]: https://img.shields.io/npm/v/connect-session-knex.svg
[npm-downloads-image]: https://img.shields.io/npm/dm/connect-session-knex.svg
[npm-image]: https://nodei.co/npm/connect-session-knex.png?downloads=true&downloadRank=true&stars=true
[npm-url]: https://npmjs.org/package/connect-session-knex
[travis-image]: https://img.shields.io/travis/llambda/connect-session-knex/master.svg
[travis-url]: https://travis-ci.org/llambda/connect-session-knex
[dependencies-image]: https://david-dm.org/llambda/connect-session-knex.svg?style=flat
[dependencies-url]: https://david-dm.org/llambda/connect-session-knex
[coveralls-image]: https://img.shields.io/coveralls/llambda/connect-session-knex/master.svg
[coveralls-url]: https://coveralls.io/r/llambda/connect-session-knex?branch=master
[node-image]: https://img.shields.io/node/v/connect-session-knex.svg
[node-url]: http://nodejs.org/download/
[gitter-join-chat-image]: https://badges.gitter.im/Join%20Chat.svg
[gitter-channel-url]: https://gitter.im/llambda/connect-session-knex
[express-session-url]: https://github.com/expressjs/session
[io-url]: https://iojs.org
