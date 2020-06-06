/* eslint-disable func-names */

const Bluebird = require('bluebird');
const knexFactory = require('knex');

const { resolve } = Bluebird;
const util = require('util');
const {
  dateAsISO,
  getMssqlFastQuery,
  getPostgresFastQuery,
  getMysqlFastQuery,
  getSqliteFastQuery,
  isMSSQL,
  isPostgres,
  isMySQL,
  isOracle,
  isSqlite3,
  timestampTypeName,
  expiredCondition,
} = require('./utils');

const oneDay = 86400000;

/*
   * Remove expired sessions from database.
   * @param {Object} store
   * @param {number} interval
   * @api private
   */
function dbCleanup(store, interval, KnexStore) {
  return store.ready
    .then(() => {
      let condition = `expired < CAST(? as ${timestampTypeName(store.knex)})`;
      if (isSqlite3(store.knex)) {
        // sqlite3 date condition is a special case.
        condition = 'datetime(expired) < datetime(?)';
      } else if (isOracle(store.knex)) {
        condition = `"expired" < CAST(? as ${timestampTypeName(store.knex)})`;
      }
      return store
        .knex(store.tablename)
        .del()
        .whereRaw(condition, dateAsISO(store.knex));
    })
    .finally(() => {
      // eslint-disable-next-line no-param-reassign
      KnexStore.nextDbCleanup = setTimeout(
        dbCleanup,
        interval,
        store,
        interval,
        KnexStore,
      ).unref();
    });
}


module.exports = function (connect) {
  /**
   * Connect's Store.
   */
  const Store = connect.session ? connect.session.Store : connect.Store;

  /*
   * Initialize KnexStore with the given options.
   *
   * @param {Object} options
   * @api public
   */
  function KnexStore(options = {}) {
    // KnexStore.prototype.__proto__ = Store.prototype;
    util.inherits(KnexStore, Store);

    const self = this;

    Store.call(self, options);

    if (!options.clearInterval) {
      // Time to run clear expired function.
      // eslint-disable-next-line no-param-reassign
      options.clearInterval = 60000;
    }

    self.createtable = Object.prototype.hasOwnProperty.call(options, 'creatable')
      ? options.createtable
      : true;
    self.tablename = options.tablename || 'sessions';
    self.sidfieldname = options.sidfieldname || 'sid';
    self.knex = options.knex
      || knexFactory({
        client: 'sqlite3',
        // debug: true,
        connection: {
          filename: 'connect-session-knex.sqlite',
        },
      });

    self.ready = self.knex.schema
      .hasTable(self.tablename)
      .then((exists) => {
        if (!exists && self.createtable) {
          return self.knex.schema.createTable(self.tablename, (table) => {
            table.string(self.sidfieldname).primary();
            if (isMSSQL(self.knex)) {
              table.text('sess').notNullable();
            } else {
              table.json('sess').notNullable();
            }
            if (isMySQL(self.knex) || isMSSQL(self.knex)) {
              table
                .dateTime('expired')
                .notNullable()
                .index();
            } else {
              table
                .timestamp('expired')
                .notNullable()
                .index();
            }
          });
        }
        return exists;
      })
      .then((exists) => {
        if (exists) {
          dbCleanup(self, options.clearInterval, KnexStore);
        }
        return null;
      });
  }

  /*
   * Attempt to fetch session by the given sid.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */
  KnexStore.prototype.get = function (sid, fn) {
    const self = this;
    return self.ready.then(() => {
      const condition = expiredCondition(self.knex);
      return resolve(self.knex
        .select('sess')
        .from(self.tablename)
        .where(self.sidfieldname, '=', sid)
        .andWhereRaw(condition, dateAsISO(self.knex))
        .then((response) => {
          let ret;
          if (response[0]) {
            ret = response[0].sess;
            if (typeof ret === 'string') {
              ret = JSON.parse(ret);
            }
          }
          return ret;
        }))
        .asCallback(fn);
    });
  };

  /*
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */
  KnexStore.prototype.set = function (sid, sessObject, fn) {
    const self = this;
    const { maxAge } = sessObject.cookie;
    const now = new Date().getTime();
    const expired = maxAge ? now + maxAge : now + oneDay;
    const sess = JSON.stringify(sessObject);

    const dbDate = dateAsISO(self.knex, expired);

    if (isSqlite3(self.knex)) {
      // sqlite optimized query
      return self.ready.then(() => resolve(self.knex
        .raw(getSqliteFastQuery(self.tablename, self.sidfieldname), [
          sid,
          dbDate,
          sess,
        ])
        .then(() => [1]))
        .asCallback(fn));
    } if (
      isPostgres(self.knex)
      && parseFloat(self.knex.client.version) >= 9.2
    ) {
      // postgresql optimized query
      return self.ready.then(() => resolve(self.knex
        .raw(getPostgresFastQuery(self.tablename, self.sidfieldname), [
          sid,
          dbDate,
          sess,
        ]))
        .asCallback(fn));
    } if (isMySQL(self.knex)) {
      // mysql/mariaDB optimized query
      return self.ready.then(() => resolve(self.knex
        .raw(getMysqlFastQuery(self.tablename, self.sidfieldname), [
          sid,
          dbDate,
          sess,
        ]))
        .asCallback(fn));
    } if (isMSSQL(self.knex)) {
      // mssql optimized query
      return self.ready.then(() => resolve(self.knex
        .raw(getMssqlFastQuery(self.tablename, self.sidfieldname), [
          sid,
          dbDate,
          sess,
        ]))
        .asCallback(fn));
    }
    return self.ready.then(() => resolve(self.knex
      .transaction((trx) => trx
        .select('*')
        .forUpdate()
        .from(self.tablename)
        .where(self.sidfieldname, '=', sid)
        .then((foundKeys) => {
          if (foundKeys.length === 0) {
            return trx.from(self.tablename).insert({
              [self.sidfieldname]: sid,
              expired: dbDate,
              sess,
            });
          }
          return trx(self.tablename)
            .where(self.sidfieldname, '=', sid)
            .update({
              expired: dbDate,
              sess,
            });
        })))
      .asCallback(fn));
  };

  /**
   * Touch the given session object associated with the given session ID.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @public
   */
  KnexStore.prototype.touch = function (sid, sess, fn) {
    if (sess && sess.cookie && sess.cookie.expires) {
      const condition = expiredCondition(this.knex);

      return resolve(this.knex(this.tablename)
        .where(this.sidfieldname, '=', sid)
        .andWhereRaw(condition, dateAsISO(this.knex))
        .update({
          expired: dateAsISO(this.knex, sess.cookie.expires),
        }))
        .asCallback(fn);
    }

    fn();
    return null;
  };

  /*
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */
  KnexStore.prototype.destroy = function (sid, fn) {
    const self = this;
    return self.ready.then(() => resolve(self.knex
      .del()
      .from(self.tablename)
      .where(self.sidfieldname, '=', sid))
      .asCallback(fn));
  };

  /*
   * Fetch number of sessions.
   *
   * @param {Function} fn
   * @api public
   */
  KnexStore.prototype.length = function (fn) {
    const self = this;
    return self.ready.then(() => resolve(self.knex
      .count(`${self.sidfieldname} as count`)
      .from(self.tablename)
      // eslint-disable-next-line no-bitwise
      .then((response) => response[0].count | 0))
      .asCallback(fn));
  };

  /*
   * Clear all sessions.
   *
   * @param {Function} fn
   * @api public
   */
  KnexStore.prototype.clear = function (fn) {
    const self = this;
    return self.ready.then(() => resolve(self.knex
      .del()
      .from(self.tablename))
      .asCallback(fn));
  };

  /* stop the dbCleanupTimeout */
  KnexStore.prototype.stopDbCleanup = function () {
    if (KnexStore.nextDbCleanup) {
      clearTimeout(KnexStore.nextDbCleanup);
      delete KnexStore.nextDbCleanup;
    }
  };

  return KnexStore;
};
