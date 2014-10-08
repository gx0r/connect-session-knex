var knex = require('knex');
var util = require('util');

var oneDay = 86400000;

module.exports = function(connect) {

  /**
  * Connect's Store.
  */
  var Store = (connect.session) ? connect.session.Store : connect.Store;

  /**
   * Return an ISO compliant string of the current time
   * @api private
   * @return {String} an ISO compliant string of the current time
   */
  function nowAsISO() {
    return (new Date()).toISOString();
  }

  /**
  * Remove expired sessions from database.
  * @param {Object} store
  * @api private
  */
  function dbCleanup(store) {
    return store.ready.then(function () {
      store.knex(store.tablename).del().whereRaw('"expired" < CAST(? as timestamp)', nowAsISO());
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
          table.json('sess').notNullable() ,
          table.timestamp('expired', 'true').notNullable()
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
    var that = this;
    return that.ready.then(function () {
      return that.knex
        .select('sess')
        .from(that.tablename)
        .where('sid', '=', sid)
        .andWhereRaw('CAST(? as timestamp) <= "expired"', nowAsISO())
        .then(function (response) {
          if (fn) {
            if (response[0]) {
              var sess = response[0].sess;
              if(typeof(sess) === "string") {
                sess = JSON.parse(sess);
              }
              fn(null, sess);
            } else{
              fn();
            }
          }
        }).catch(function(err) {
          fn(err);
        });
    });
  };


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
    var postgresfastq = 'with new_values (sid, expired, sess) as (' +
            '  values ($1, $2::timestamp without time zone, $3::json)' +
            '), ' +
            'upsert as ' +
            '( ' +
            '  update ' + that.tablename + ' cs set ' +
            '    sid = nv.sid, ' +
            '    expired = nv.expired, ' +
            '    sess = nv.sess ' +
            '  from new_values nv ' +
            '  where cs.sid = nv.sid ' +
            '  returning cs.* ' +
            ')' +
            'insert into ' + that.tablename + ' (sid, expired, sess) ' +
            'select sid, expired, sess ' +
            'from new_values ' +
            'where not exists (select 1 from upsert up where up.sid = new_values.sid)';

    if ('postgresql' === that.knex.client.dialect) {
      // postgresql optimized query
      return that.ready.then(function () {
        return that.knex.raw(postgresfastq, [sid, new Date(expired), sess ])
        .then(function (result) {
          if (fn) {
            fn(null, result);
          }
        })
      })
    } else {
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
    }
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
