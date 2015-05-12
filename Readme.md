# Connect Session Knex


[![NPM Version][npm-version-image]][npm-url]
[![NPM Downloads][npm-downloads-image]][npm-url]
[![Node.js Version][node-image]][node-url]
[![Build Status][travis-image]][travis-url]
[![Dependency Status][dependencies-image]][dependencies-url]
[![Coverage Status][coveralls-image]][coveralls-url]

[![NPM][npm-image]][npm-url]

connect-session-knex is an [express-session](https://github.com/expressjs/session) store backed by Postgres, MySQL, MariaDB or SQLite3, via the [knex.js](http://knexjs.org/) library.

## Installation

```sh
$ npm install connect-session-knex
```

## Usage

[Example application using the defaults](https://github.com/llambda/connect-session-knex/blob/master/example.js)

[Example application with PostgreSQL](https://github.com/llambda/connect-session-knex/blob/master/example-postgres.js)

[With Express 3 or Connect](https://github.com/llambda/connect-session-knex/blob/master/Oldversions.md)

## Options

 - `tablename='sessions'` Tablename to use. Defaults to 'sessions'.
 - `knex` knex instance to use. Defaults to a new knex instance, using sqlite3 with a file named 'connect-session-knex.sqlite'

## Benchmarks

[https://github.com/llambda/express-session-benchmarks](https://github.com/llambda/express-session-benchmarks)

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
