import knex, { Knex } from "knex";
import { SessionData, Store } from "express-session";
import {
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
} from "./utils";

interface Options {
  clearInterval?: number;
  disableDbCleanup?: boolean;
  createtable?: boolean;
  knex?: Knex;
  onDbCleanupError?: (err: Error) => void;
  tablename?: string;
  sidfieldname?: string;
}

export class ConnectSessionKnexStore extends Store {
  clearInterval = 60000;
  createtable = true;
  disableDbCleanup = false;
  knex: Knex;
  nextDbCleanup: NodeJS.Timeout | undefined;
  ready: Promise<unknown>;
  sidfieldname = "sid";
  tablename = "sessions";
  onDbCleanupError = (_: Error) => {};

  constructor(options: Options) {
    super();

    if (options.clearInterval != null) {
      this.clearInterval = options.clearInterval;
    }

    if (options.disableDbCleanup != null) {
      this.disableDbCleanup = options.disableDbCleanup;
    }

    if (options.createtable != null) {
      this.createtable = options.createtable;
    }

    if (options.tablename) {
      this.tablename = options.tablename;
    }

    if (options.sidfieldname) {
      this.sidfieldname = options.sidfieldname;
    }

    if (options.onDbCleanupError) {
      this.onDbCleanupError = options.onDbCleanupError;
    }

    this.knex =
      options.knex ||
      knex({
        client: "sqlite3",
        // debug: true,
        connection: {
          filename: "connect-session-knex.sqlite",
        },
      });

    this.ready = this.knex.schema
      .hasTable(this.tablename)
      .then((exists) => {
        if (!exists && this.createtable) {
          return new Promise((res) => {
            isDbSupportJSON(this.knex).then((isSupport) =>
              this.knex.schema.createTable(this.tablename, (table) => {
                table.string(this.sidfieldname).primary();
                if (isSupport) {
                  table.json("sess").notNullable();
                } else {
                  table.text("sess").notNullable();
                }
                if (isMySQL(this.knex) || isMSSQL(this.knex)) {
                  table.dateTime("expired").notNullable().index();
                } else {
                  table.timestamp("expired").notNullable().index();
                }
                res(null);
              }),
            );
          });
        }
        return exists;
      })
      .then((exists) => {
        if (exists && !options.disableDbCleanup) {
          this.setNextDbCleanup(
            this,
            this.clearInterval,
            this.onDbCleanupError,
          );
        }
        return null;
      });
  }

  async get(
    sid: string,
    callback: (err: any, session?: SessionData | null) => void,
  ) {
    try {
      await this.ready;
      const condition = expiredCondition(this.knex);

      const response = await this.knex
        .select("sess")
        .from(this.tablename)
        .where(this.sidfieldname, "=", sid)
        .andWhereRaw(condition, dateAsISO(this.knex));

      let retVal;
      if (response[0]) {
        retVal = response[0].sess;
        if (typeof retVal === "string") {
          retVal = JSON.parse(retVal);
        }
      }
      callback?.(null, retVal);
      return retVal;
    } catch (err) {
      callback?.(err);
      throw err;
    }
  }

  async set(sid: string, session: SessionData, callback?: (err?: any) => void) {
    const { maxAge } = session.cookie;
    const now = new Date().getTime();
    const expired = maxAge ? now + maxAge : now + 86400000; // 86400000 = add one day
    const sess = JSON.stringify(session);

    const dbDate = dateAsISO(this.knex, expired);

    try {
      await this.ready;

      let retVal;
      if (isSqlite3(this.knex)) {
        // sqlite optimized query
        retVal = await this.knex.raw(
          getSqliteFastQuery(this.tablename, this.sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (
        isPostgres(this.knex) &&
        parseFloat(this.knex.client.version) >= 9.2
      ) {
        // postgresql optimized query
        retVal = await this.knex.raw(
          getPostgresFastQuery(this.tablename, this.sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (isMySQL(this.knex)) {
        retVal = await this.knex.raw(
          getMysqlFastQuery(this.tablename, this.sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (isMSSQL(this.knex)) {
        retVal = await this.knex.raw(
          getMssqlFastQuery(this.tablename, this.sidfieldname),
          [sid, dbDate, sess],
        );
      } else {
        retVal = await this.knex.transaction(async (trx) => {
          const foundKeys = await trx
            .select("*")
            .forUpdate()
            .from(this.tablename)
            .where(this.sidfieldname, "=", sid);

          if (foundKeys.length === 0) {
            await trx.from(this.tablename).insert({
              [this.sidfieldname]: sid,
              expired: dbDate,
              sess,
            });
          } else {
            await trx(this.tablename)
              .where(this.sidfieldname, "=", sid)
              .update({
                expired: dbDate,
                sess,
              });
          }
        });
      }

      callback?.(null);
      return retVal;
    } catch (err) {
      callback?.(err);
      throw err;
    }
  }

  async touch?(sid: string, session: SessionData, callback?: () => void) {
    if (session && session.cookie && session.cookie.expires) {
      const condition = expiredCondition(this.knex);

      const retVal = await this.knex(this.tablename)
        .where(this.sidfieldname, "=", sid)
        .andWhereRaw(condition, dateAsISO(this.knex))
        .update({
          expired: dateAsISO(this.knex, session.cookie.expires),
        });

      callback?.();
      return retVal;
    }

    return null;
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    await this.ready;
    try {
      const retVal = await this.knex
        .del()
        .from(this.tablename)
        .where(this.sidfieldname, "=", sid);
      callback?.(null);
      return retVal;
    } catch (err) {
      callback?.(err);
      throw err;
    }
  }

  async length(callback: (err: any, length?: number) => void) {
    await this.ready;

    try {
      let retVal;
      const response = await this.knex
        .count(`${this.sidfieldname} as count`)
        .from(this.tablename);

      if (response.length === 1 && "count" in response[0]) {
        retVal = +(response[0].count ?? 0);
      }

      callback?.(null, retVal);
      return retVal;
    } catch (err) {
      callback?.(err);
      throw err;
    }
  }

  async clear(callback?: (err?: any) => void) {
    try {
      await this.ready;
      const res = await this.knex.del().from(this.tablename);
      callback?.(null);
      return res;
    } catch (err) {
      callback?.(err);
      throw err;
    }
  }

  async all(
    callback: (
      err: any,
      obj?: SessionData[] | { [sid: string]: SessionData } | null,
    ) => void,
  ) {
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

      callback?.(null, items);
      return items;
    } catch (err) {
      callback?.(err);
      throw err;
    }
  }

  /*
   * Remove expired sessions from database.
   * @param {Object} store
   * @param {number} interval
   * @api private
   */
  async setNextDbCleanup(
    store: ConnectSessionKnexStore,
    interval: number,
    callback?: (err?: any) => void,
  ) {
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
      callback?.(err);
    } finally {
      this.nextDbCleanup = setTimeout(
        this.setNextDbCleanup,
        interval,
        store,
        interval,
        callback,
      ).unref();
    }
  }

  /* stop the dbCleanupTimeout */
  stopDbCleanup() {
    if (this.nextDbCleanup) {
      clearTimeout(this.nextDbCleanup);
      delete this.nextDbCleanup;
    }
  }

  /* fetch the dbCleanupTimeout */
  getNextDbCleanup() {
    return this.nextDbCleanup;
  }
}
