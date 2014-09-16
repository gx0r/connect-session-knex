# Connect Session Knex

connect-session-knex is a session store using [knex.js](http://knexjs.org/) as the backend.


## Installation

	  $ npm install connect-session-knex

## Options

 - `tablename='sessions'` Tablename to use
 - `knex` knex instance to use. If not provided, creates a new knex using sqlite3 with filename 'connect-session-knex.sqlite'

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

connect-session-knex with postgres 9.3: 8,921 ms (query code prior to 2014/7/14)

connect-session-knex with postgres 9.3 and optimized query: 3,686 ms (query code on 2014/7/14)

[connect-pgsql](https://github.com/tpaszun/connect-pgsql) 2,255 ms

### Redis

[connect-redis](https://github.com/visionmedia/connect-redis): 330 ms

### Cassandra
node-cassandra-cql 0.4.4:  2640ms



