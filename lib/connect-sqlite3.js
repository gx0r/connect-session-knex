/*
* Connect - SQLite3
* Copyright(c) 2012 David Feinberg
* MIT Licensed
* forked from https://github.com/tnantoka/connect-sqlite
*/

/**
* Module dependencies.
*/

var sqlite3 = require('sqlite3'),
    events = require('events');

/**
* One day in milliseconds.
*/

var oneDay = 86400000;

/**
* Return the SQLiteStore extending connect's session Store.
*
* @param {object} connect
* @return {Function}
* @api public
*/

module.exports = function(connect) {

    /**
    * Connect's Store.
    */

    var Store = (connect.session) ? connect.session.Store : connect.Store;

    /**
    * Remove expired sessions from database.
    * @param {Object} store
    * @api private
    */

    function dbCleanup(store) {
        var now = new Date().getTime();
        store.db.run('DELETE FROM ' + store.table + ' WHERE ? > expired', [now]);
    }

    /**
    * Initialize SQLiteStore with the given options.
    *
    * @param {Object} options
    * @api public
    */

    function SQLiteStore(options) {
        options = options || {};
        Store.call(this, options);

        this.table = options.table || 'sessions';
        this.db = options.db || this.table;
        var dbPath;

        if(this.db !== ':memory:') {
            dbPath = (options.dir || '.') + '/' + this.db + '.db';
        } else {
            dbPath = this.db;
        }

        this.db = new sqlite3.Database(dbPath);
        this.client = new events.EventEmitter();
        var self = this;

        this.db.exec('CREATE TABLE IF NOT EXISTS ' + this.table + ' (' + 'sid PRIMARY KEY, ' + 'expired, sess)',
            function(err) {
                if (err) throw err;
                self.client.emit('connect');

                dbCleanup(self);
                setInterval(dbCleanup, oneDay, self).unref();
            }
        );
    }
  
    /**
    * Inherit from Store.
    */

    SQLiteStore.prototype.__proto__ = Store.prototype;

    /**
    * Attempt to fetch session by the given sid.
    *
    * @param {String} sid
    * @param {Function} fn
    * @api public
    */

    SQLiteStore.prototype.get = function(sid, fn) {
        var now = new Date().getTime();
        this.db.get('SELECT sess FROM ' + this.table + ' WHERE sid = ? AND ? <= expired', [sid, now],
            function(err, row) {
                if (err) fn(err);
                if (!row) return fn();
                fn(null, JSON.parse(row.sess));
            }
        );
    };


  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  SQLiteStore.prototype.set = function(sid, sess, fn) {
    try {
      var maxAge = sess.cookie.maxAge;
      var now = new Date().getTime();
      var expired = maxAge ? now + maxAge : now + oneDay;
      sess = JSON.stringify(sess);

      this.db.all('INSERT OR REPLACE INTO ' + this.table + ' VALUES (?, ?, ?)',
        [sid, expired, sess],
        function(err, rows) {
          if (fn) fn.apply(this, arguments);
        }
      );
    } catch (e) {
      if (fn) fn(e);
    }
  };


    /**
    * Destroy the session associated with the given `sid`.
    *
    * @param {String} sid
    * @api public
    */

    SQLiteStore.prototype.destroy = function(sid, fn) {
        this.db.run('DELETE FROM ' + this.table + ' WHERE sid = ?', [sid], fn);
    };


    /**
    * Fetch number of sessions.
    *
    * @param {Function} fn
    * @api public
    */

    SQLiteStore.prototype.length = function(fn) {
        this.db.all('SELECT COUNT(*) AS count FROM ' + this.table + '', function(err, rows) {
            if (err) fn(err);
            fn(null, rows[0].count);
        });
    };


    /**
    * Clear all sessions.
    *
    * @param {Function} fn
    * @api public
    */

    SQLiteStore.prototype.clear = function(fn) {
        this.db.exec('DELETE FROM ' + this.table + '', function(err) {
            if (err) fn(err);
            fn(null, true);
        });
    };

    return SQLiteStore;

};
