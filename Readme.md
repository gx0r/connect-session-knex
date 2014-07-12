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

# Insert 1000 sessions

sqlite3: 1610ms
postgres 9.3: 8921ms

