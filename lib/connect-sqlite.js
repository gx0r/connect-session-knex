/*!
 * Connect - SQLite
 * Copyright(c) 2011 tnantoka <bornneet@livedoor.com>
 * MIT Licensed
 * forked from https://github.com/visionmedia/connect-redis 
 */

/**
 * Module dependencies.
 */

var sqlite = require('sqlite');
var events = require('events');

/**
 * One day in seconds.
 */

var oneDay = 86400;

/**
 * Return the `RedisStore` extending `connect`'s session Store.
 *
 * @param {object} connect
 * @return {Function}
 * @api public
 */

module.exports = function(connect){

  /**
   * Connect's Store.
   */

  var Store = connect.session.Store;

  /**
   * Initialize RedisStore with the given `options`.
   *
   * @param {Object} options
   * @api public
   */

  function SQLiteStore(options) {
    options = options || {};
    Store.call(this, options);

    this.table = options.db || 'sessions';
    this.db = new sqlite.Database();
    this.client = new events.EventEmitter();
    var self = this;

    var dbFile = (options.dir || '.') + '/' + this.table + '.db';

    this.db.open(dbFile, function(err) {
      if (err) throw err;
      self.db.executeScript('CREATE TABLE IF NOT EXISTS ' + self.table + ' (' +
        'sid PRIMARY KEY, ' +
        'expired, sess);',
        function(err) {
          if (err) throw err;
          self.client.emit('connect');
        }
      );
    });
  }
  
  /**
   * Inherit from `Store`.
   */

  SQLiteStore.prototype.__proto__ = Store.prototype;

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  SQLiteStore.prototype.get = function(sid, fn){
    var now = new Date().getTime();
    this.db.execute('SELECT sess FROM ' + this.table + ' WHERE sid = ? AND ? <= expired;',
      [sid, now],
      function(err, rows) {
        if (err) fn(err);
        // AssesionError occurs !?
        //try {
          if (!rows || rows.length === 0) {
            return fn();
          }
          fn(null, JSON.parse(rows[0].sess));
        //} catch (e) {
        //  fn(e);
        //}
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

      this.db.execute('INSERT OR REPLACE INTO ' + this.table + ' VALUES (?, ?, ?);',
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

  SQLiteStore.prototype.destroy = function(sid, fn){
    this.db.execute('DELETE FROM ' + this.table + ' WHERE sid = ?;', [sid], fn);
  };


  /**
   * Fetch number of sessions.
   *
   * @param {Function} fn
   * @api public
   */

  SQLiteStore.prototype.length = function(fn){
    this.db.execute('SELECT COUNT(*) AS count FROM ' + this.table + ';', function(err, rows) {
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

  SQLiteStore.prototype.clear = function(fn){
    //this.db.executeScript('TRUNCATE TABLE ' + this.table + ';', fn);
    this.db.executeScript('DELETE FROM ' + this.table + ';', function(err) {
      if (err) fn(err);
      fn(null, true);
    });
  };

  return SQLiteStore;
};
