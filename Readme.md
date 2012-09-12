
# Connect SQLite3

connect-sqlite3 is a SQLite3 session store, modeled after connect-redis.

## Installation

	  $ npm install connect-sqlite3

## Options

  - `db='sessions'` Database table name
  - `db= Database file name (defaults to table name)
  - `dir='.'` Direcotry to save '<db>.db' file

## Usage

    var connect = require('connect'),
        SQLiteStore = require('connect-sqlite3')(connect);

    connect.createServer(
      connect.cookieParser(),
      connect.session({ store: new SQLiteStore, secret: 'your secret' })
    );

  with express    

    var SQLiteStore = require('connect-sqlite3')(express);

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

