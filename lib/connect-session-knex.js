var knex = require('knex');

var oneDay = 86400000;

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
    // var now = new Date().getTime();
    // store.db.run('DELETE FROM ' + store.table + ' WHERE ? > expired', [now]);

    return store.ready.then(function () {
      store.knex(store.tablename).del().where('expired', '<', new Date());
    });
  }

  /**
  * Initialize KnexStore with the given options.
  *
  * @param {Object} options
  * @api public
  */

  function KnexStore(options) {
    var that = this;

    options = options || {};
    Store.call(this, options);

    this.tablename = options.tablename || 'sessions';
    this.knex = options.knex || require('knex')({
      client: 'sqlite3',
      // debug: true,
      connection: {
        filename: "connect-session-knex.sqlite"
      }
    });

    // this.client = new events.EventEmitter();

    // this.db.exec('CREATE TABLE IF NOT EXISTS ' + this.table + ' (' + 'sid PRIMARY KEY, ' + 'expired, sess)',
    //     function(err) {
    //         if (err) throw err;
    //         that.client.emit('connect');
    //
    //         dbCleanup(that);
    //         setInterval(dbCleanup, oneDay, that).unref();
    //     }
    // );

    this.ready = that.knex.schema.hasTable(that.tablename).then(function (exists) {
      if (!exists) {
        return that.knex.schema.createTable(that.tablename, function (table) {
          table.string('sid'),
          table.string('sess'),
          table.date('expired')
        })
      }
    })
    .then(function () {
      dbCleanup(that);
      setInterval(dbCleanup, oneDay, that).unref();
    })
  }

  /**
  * Inherit from Store.
  */

  KnexStore.prototype.__proto__ = Store.prototype;

  /**
  * Attempt to fetch session by the given sid.
  *
  * @param {String} sid
  * @param {Function} fn
  * @api public
  */

  KnexStore.prototype.get = function(sid, fn) {
    var now = new Date().getTime();
    var that = this;
    // this.db.get('SELECT sess FROM ' + this.table + ' WHERE sid = ? AND ? <= expired', [sid, now],
    //     function(err, row) {
    //         if (err) fn(err);
    //         if (!row) return fn();
    //         fn(null, JSON.parse(row.sess));
    //     }
    // );
    return that.ready.then(function () {
      return that.knex.from(that.tablename).select('*').where('sid', '=', sid).andWhere(now, '<=', 'expired')
        .then(function (response) {
          if (fn) {
            if (response[0]) {
              fn(null, JSON.parse(response[0].sess));
            } else{
              fn();
            }
          }
        })
    });
  }


  /**
  * Commit the given `sess` object associated with the given `sid`.
  *
  * @param {String} sid
  * @param {Session} sess
  * @param {Function} fn
  * @api public
  */

  KnexStore.prototype.set = function(sid, sess, fn) {
    var that = this;
    var maxAge = sess.cookie.maxAge;
    var now = new Date().getTime();
    var expired = maxAge ? now + maxAge : now + oneDay;
    sess = JSON.stringify(sess);

    //   this.db.all('INSERT OR REPLACE INTO ' + this.table + ' VALUES (?, ?, ?)',
    //     [sid, expired, sess],
    //     function(err, rows) {
    //       if (fn) fn.apply(this, arguments);
    //     }
    //   );
    // } catch (e) {
    //   if (fn) fn(e);
    // }

    return that.ready.then(function () {
      return that.knex.transaction(function (trx) {
        return trx.select('*').forUpdate().from(that.tablename).where('sid', '=', sid)
        .then(function (foundKeys) {
          if (foundKeys.length == 0) {
            return trx.from(that.tablename)
            .insert({
              sid: sid,
              expired: expired,
              sess: sess
            })
          } else {
            return trx(that.tablename)
            .where('sid', '=', sid)
            .update({
              expired: expired,
              sess: sess
            })
          }
        })
        .then(function (res) {
          if (fn) {
            fn(null);
          }
          return res;
        })
      })
    })
  };


  /**
  * Destroy the session associated with the given `sid`.
  *
  * @param {String} sid
  * @api public
  */

  KnexStore.prototype.destroy = function(sid, fn) {
    // this.db.run('DELETE FROM ' + this.table + ' WHERE sid = ?', [sid], fn);

    return that.knex.del().from(that.tablename).where('sid', '=', sid).then(function (response) {
      if (fn) {
        fn(null, true);
      }
    });
  };


  /**
  * Fetch number of sessions.
  *
  * @param {Function} fn
  * @api public
  */

  KnexStore.prototype.length = function(fn) {
    return that.knex.select('count(*) as count').from(that.tablename).then(function (response) {
      if (fn) {
        fn(null, response[0]);
      }
    });
  };


  /**
  * Clear all sessions.
  *
  * @param {Function} fn
  * @api public
  */

  KnexStore.prototype.clear = function(fn) {
    // this.db.exec('DELETE FROM ' + this.table + '', function(err) {
    //     if (err) fn(err);
    //     fn(null, true);
    // });

    return that.knex.del().from(that.tablename).then(function (response) {
      if (fn) {
        fn(null, true);
      }
    });
  };

  return KnexStore;
};
