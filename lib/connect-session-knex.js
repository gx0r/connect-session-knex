var knex = require('knex');
var util = require('util');

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

    this.ready = that.knex.schema.hasTable(that.tablename).then(function (exists) {
      if (!exists) {
        return that.knex.schema.createTable(that.tablename, function (table) {
          table.string('sid').primary(),
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

  // KnexStore.prototype.__proto__ = Store.prototype;
  util.inherits(KnexStore, Store);

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

    return that.ready.then(function () {
      return that.knex.transaction(function (trx) {
        return trx.select('*').forUpdate().from(that.tablename).where('sid', '=', sid)
        .then(function (foundKeys) {
          if (foundKeys.length == 0) {
            return trx.from(that.tablename)
            .insert({
              sid: sid,
              expired: new Date(expired),
              sess: sess
            })
          } else {
            return trx(that.tablename)
            .where('sid', '=', sid)
            .update({
              expired: new Date(expired),
              sess: sess
            })
          }
        })
        .then(function (res) {
          if (fn) {
            fn(null, res);
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
    var that = this;
    return that.ready.then(function () {
      return that.knex.del().from(that.tablename).where('sid', '=', sid).then(function (response) {
        if (fn) {
          fn(null, true);
        }
      })
    });
  };


  /**
  * Fetch number of sessions.
  *
  * @param {Function} fn
  * @api public
  */
  KnexStore.prototype.length = function(fn) {
    var that=this;
    return that.ready.then(function () {
      return that.knex.count('sid as count').from(that.tablename).then(function (response) {
        if (fn) {
          fn(null, response[0].count);
        }
      })
    });
  };


  /**
  * Clear all sessions.
  *
  * @param {Function} fn
  * @api public
  */
  KnexStore.prototype.clear = function(fn) {
    var that=this;
    return that.ready.then(function () {
      return that.knex.del().from(that.tablename).then(function (response) {
        if (fn) {
          fn(null, true);
        }
      })
    });
  };

  return KnexStore;
};
