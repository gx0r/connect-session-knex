# Connect SQLite3

connect-session-knex is a session store using [knex.js](http://knexjs.org/) as the backend.


## Installation

	  $ npm install connect-session-knex

## Options

 - `tablename='sessions'` Tablename to use
 - `knex` knex instance to use. If not provided, creates a new knex using sqlite3 with filename 'connect-session-knex.sqlite'

## Usage

    var connect = require('connect'),
        SQLiteStore = require('connect-session-knex')(connect);

    connect.createServer(
      connect.cookieParser(),
      connect.session({ store: new SQLiteStore, secret: 'your secret' })
    );

  with express

    3.x:
    var SQLiteStore = require('connect-session-knex')(express);

    4.x:
    var session = require('express-session');
    var SQLiteStore = require('connect-session-knex')(session);

    app.configure(function() {
      app.set('views', __dirname + '/views');
      app.set('view engine', 'ejs');
      app.use(express.bodyParser());
      app.use(express.methodOverride());
      app.use(express.cookieParser());
      app.use(express.session({
        store: new SQLiteStore,
        secret: 'your secret',
        cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 1 week
      }));
      app.use(app.router);
      app.use(express.static(__dirname + '/public'));
    });
