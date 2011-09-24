
# Connect Redis

connect-sqlite is a SQLite session store, just copied connect-redis.

 connect-sqlite support only connect `>= 1.4.0`.

## Installation

	  $ npm install connect-sqlite

## Options

  - `db='sessions'` Database file & table name
  - `dir='.'` Direcotry to save '<db>.db' file

## Usage

    var connect = require('connect')
	 	  , SQLiteStore = require('connect-sqlite')(connect);

    connect.createServer(
      connect.cookieParser(),
      connect.session({ store: new SQLiteStore, secret: 'your secret' })
    );

  with express    

    var SQLiteStore = require('connect-sqlite')(express);

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

