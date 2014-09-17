# Connect Session Knex

connect-session-knex is a session store using [knex.js](http://knexjs.org/), which is a SQL query builder for Postgres, MySQL, MariaDB and SQLite3.

Note: I could not get it to work with MariaDB using the mysql or mariadb drivers.

## Installation

	  $ npm install connect-session-knex

## Options

 - `tablename='sessions'` Tablename to use. Defaults to 'sessions'.
 - `knex` knex instance to use. Defaults to a new knex instance, using sqlite3 with a file named 'connect-session-knex.sqlite'

## Usage
  With connect:

    var connect = require('connect'),
        KnexSessionStore = require('connect-session-knex')(connect);

    connect.createServer(
      connect.cookieParser(),
      connect.session({ store: new KnexSessionStore, secret: 'your secret' })
    );

  With express 3.x:
  
    var KnexSessionStore = require('connect-session-knex')(express);

    app.configure(function() {
      app.use(express.session({
        store: new KnexSessionStore,
        secret: 'your secret',
        cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
      }));
    });

  With express 4.x:
  
    var session = require('express-session');
    var KnexSessionStore = require('connect-session-knex')(session);

    app.use(express.session({
      store: new KnexSessionStore,
      secret: 'your secret',
      cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
    }));
    
## Benchmarks

### Insert 10,000 sessions

### Sqlite 3

connect-session-knex with sqlite3: 16,128 ms

[connect-sqlite3](https://github.com/rawberg/connect-sqlite3): 6,829 ms

### PostgreSQL 9.3

connect-session-knex v0.0.1: 8,921 ms

connect-session-knex v0.0.2: 3,686 ms

[connect-pgsql](https://github.com/tpaszun/connect-pgsql) 2,255 ms

### Redis

[connect-redis](https://github.com/visionmedia/connect-redis): 330 ms

### Cassandra
[connect-cassandra-cql](https://github.com/asafyish/connect-cassandra-cql) v0.1.4:  2,640ms



