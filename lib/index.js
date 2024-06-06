const knexFactory = require("knex").knex; // https://github.com/knex/knex/blob/master/UPGRADING.md#upgrading-to-version-0950

const util = require("util");
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
  isDbSupportJSON,
} = require("./utils");

const ONE_DAY = 86400000;

/*
 * Remove expired sessions from database.
 * @param {Object} store
 * @param {number} interval
 * @api private
 */
async function dbCleanup(store, interval, KnexStore, errorCallback) {
  await store.ready;
  try {
    let condition = `expired < CAST(? as ${timestampTypeName(store.knex)})`;
    if (isSqlite3(store.knex)) {
      // sqlite3 date condition is a special case.
      condition = "datetime(expired) < datetime(?)";
    } else if (isOracle(store.knex)) {
      condition = `"expired" < CAST(? as ${timestampTypeName(store.knex)})`;
    }
    await store
      .knex(store.tablename)
      .del()
      .whereRaw(condition, dateAsISO(store.knex));
  } catch (err) {
    errorCallback(err);
  } finally {
    KnexStore.nextDbCleanup = setTimeout(
      dbCleanup,
      interval,
      store,
      interval,
      KnexStore,
      errorCallback
    ).unref();
  }
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
      options.clearInterval = 60000;
    }

    if (!options.disableDbCleanup) {
      options.disableDbCleanup = false;
    }

    self.createtable = Object.prototype.hasOwnProperty.call(
      options,
      "createtable"
    )
      ? options.createtable
      : true;
    self.tablename = options.tablename || "sessions";
    self.sidfieldname = options.sidfieldname || "sid";
    self.knex =
      options.knex ||
      knexFactory({
        client: "sqlite3",
        // debug: true,
        connection: {
          filename: "connect-session-knex.sqlite",
        },
      });

    self.ready = self.knex.schema
      .hasTable(self.tablename)
      .then((exists) => {
        if (!exists && self.createtable) {
          return new Promise((res) => {
            isDbSupportJSON(self.knex).then((isSupport) =>
              self.knex.schema.createTable(self.tablename, (table) => {
                table.string(self.sidfieldname).primary();
                if (isSupport) {
                  table.json("sess").notNullable();
                } else {
                  table.text("sess").notNullable();
                }
                if (isMySQL(self.knex) || isMSSQL(self.knex)) {
                  table.dateTime("expired").notNullable().index();
                } else {
                  table.timestamp("expired").notNullable().index();
                }
                res();
              })
            );
          });
        }
        return exists;
      })
      .then((exists) => {
        if (exists && !options.disableDbCleanup) {
          dbCleanup(
            self,
            options.clearInterval,
            KnexStore,
            options.onDbCleanupError
          );
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
  KnexStore.prototype.get = async function (sid, fn) {
    try {
      await this.ready;
      const condition = expiredCondition(this.knex);

      const response = await this.knex
        .select("sess")
        .from(this.tablename)
        .where(this.sidfieldname, "=", sid)
        .andWhereRaw(condition, dateAsISO(this.knex));

      let ret;
      if (response[0]) {
        ret = response[0].sess;
        if (typeof ret === "string") {
          ret = JSON.parse(ret);
        }
      }
      fn?.(null, ret);
      return ret;
    } catch (err) {
      fn?.(err);
      throw err;
    }
  };

  /*
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */
  KnexStore.prototype.set = async function (sid, sessObject, fn) {
    const self = this;
    const { maxAge } = sessObject.cookie;
    const now = new Date().getTime();
    const expired = maxAge ? now + maxAge : now + ONE_DAY;
    const sess = JSON.stringify(sessObject);

    const dbDate = dateAsISO(self.knex, expired);

    try {
      await self.knex;

      let retVal;
      if (isSqlite3(self.knex)) {
        // sqlite optimized query
        retVal = await self.knex.raw(
          getSqliteFastQuery(self.tablename, self.sidfieldname),
          [sid, dbDate, sess]
        );
      } else if (
        isPostgres(self.knex) &&
        parseFloat(self.knex.client.version) >= 9.2
      ) {
        // postgresql optimized query
        retVal = await self.knex.raw(
          getPostgresFastQuery(self.tablename, self.sidfieldname),
          [sid, dbDate, sess]
        );
      } else if (isMySQL(self.knex)) {
        retVal = await self.knex.raw(
          getMysqlFastQuery(self.tablename, self.sidfieldname),
          [sid, dbDate, sess]
        );
      } else if (isMSSQL(self.knex)) {
        retVal = await self.knex.raw(
          getMssqlFastQuery(self.tablename, self.sidfieldname),
          [sid, dbDate, sess]
        );
      } else {
        retVal = await self.knex.transaction((trx) =>
          trx
            .select("*")
            .forUpdate()
            .from(self.tablename)
            .where(self.sidfieldname, "=", sid)
            .then((foundKeys) => {
              if (foundKeys.length === 0) {
                return trx.from(self.tablename).insert({
                  [self.sidfieldname]: sid,
                  expired: dbDate,
                  sess,
                });
              }
              return trx(self.tablename)
                .where(self.sidfieldname, "=", sid)
                .update({
                  expired: dbDate,
                  sess,
                });
            })
        );
      }

      fn?.(null, retVal);
    } catch (err) {
      fn?.(err);
      throw err;
    }
  };

  /**
   * Touch the given session object associated with the given session ID.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @public
   */
  KnexStore.prototype.touch = async function (sid, sess, fn) {
    if (sess && sess.cookie && sess.cookie.expires) {
      const condition = expiredCondition(this.knex);

      try {
        const retVal = await this.knex(this.tablename)
          .where(this.sidfieldname, "=", sid)
          .andWhereRaw(condition, dateAsISO(this.knex))
          .update({
            expired: dateAsISO(this.knex, sess.cookie.expires),
          });

        fn(null, retVal);
        return retVal;
      } catch (err) {
        fn(err);
        throw err;
      }
    }

    return null;
  };

  /*
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */
  KnexStore.prototype.destroy = async function (sid, fn) {
    await this.ready;
    try {
      const retVal = await this.knex
        .del()
        .from(this.tablename)
        .where(this.sidfieldname, "=", sid);
      fn?.(null, retVal);
      return retVal;
    } catch (err) {
      fn?.(err);
      throw err;
    }
  };

  /*
   * Fetch number of sessions.
   *
   * @param {Function} fn
   * @api public
   */
  KnexStore.prototype.length = async function (fn) {
    await this.ready;

    try {
      const response = await this.knex
        .count(`${this.sidfieldname} as count`)
        .from(this.tablename);

      const retVal = response[0].count ?? 0;
      fn?.(null, retVal);
      return retVal;
    } catch (err) {
      fn?.(err);
      throw err;
    }
  };

  /*
   * Clear all sessions.
   *
   * @param {Function} fn
   * @api public
   */
  KnexStore.prototype.clear = async function (fn) {
    try {
      await this.ready;
      const res = await this.knex.del().from(this.tablename);
      fn?.(null, res);
      return res;
    } catch (err) {
      fn?.(err);
      throw err;
    }
  };

  /* stop the dbCleanupTimeout */
  KnexStore.prototype.stopDbCleanup = function () {
    if (KnexStore.nextDbCleanup) {
      clearTimeout(KnexStore.nextDbCleanup);
      delete KnexStore.nextDbCleanup;
    }
  };

  /* fetch the dbCleanupTimeout */
  KnexStore.prototype.getNextDbCleanup = function () {
    return KnexStore.nextDbCleanup ? KnexStore.nextDbCleanup : null;
  };

  /*
   * Attempt to fetch all sessions.
   *
   * @param {Function} fn
   * @api public
   */
  KnexStore.prototype.all = async function (fn) {
    await this.ready;

    try {
      const condition = expiredCondition(this.knex);
      const rows = await this.knex
        .select("sess")
        .from(this.tablename)
        .whereRaw(condition, dateAsISO(this.knex));

      const items = rows.map((row) => {
        if (typeof row.sess === "string") {
          return JSON.parse(row.sess);
        }

        return row.sess;
      });

      fn?.(null, items);
      return items;
    } catch (err) {
      fn?.(err);
      throw err;
    }
  };

  return KnexStore;
};
