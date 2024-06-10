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
  clearInterval: number;
  disableDbCleanup: boolean;
  createtable: boolean;
  knex: Knex;
  onDbCleanupError: (err: unknown) => void;
  tablename: string;
  sidfieldname: string;
}

export class ConnectSessionKnexStore extends Store {
  options: Options;
  nextDbCleanup: NodeJS.Timeout | undefined;
  ready: Promise<unknown>;

  constructor(options: Partial<Options>) {
    super();

    this.options = {
      clearInterval: 60000,
      createtable: true,
      disableDbCleanup: false,
      sidfieldname: "sid",
      tablename: "sessions",
      onDbCleanupError: (err: unknown) => {
        console.error(err);
      },
      ...options,
      knex:
        options.knex ??
        knex({
          client: "sqlite3",
          connection: {
            filename: "connect-session-knex.sqlite",
          },
        }),
    };

    this.ready = this.options.knex.schema
      .hasTable(this.options.tablename)
      .then((exists) => {
        if (!exists && this.options.createtable) {
          return new Promise((res) => {
            isDbSupportJSON(this.options.knex).then((isSupport) =>
              this.options.knex.schema.createTable(this.options.tablename, (table) => {
                table.string(this.options.sidfieldname).primary();
                if (isSupport) {
                  table.json("sess").notNullable();
                } else {
                  table.text("sess").notNullable();
                }
                if (isMySQL(this.options.knex) || isMSSQL(this.options.knex)) {
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
          this.queueNextDbCleanup();
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
      const condition = expiredCondition(this.options.knex);

      const response = await this.options.knex
        .select("sess")
        .from(this.options.tablename)
        .where(this.options.sidfieldname, "=", sid)
        .andWhereRaw(condition, dateAsISO(this.options.knex));

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

    const dbDate = dateAsISO(this.options.knex, expired);

    try {
      await this.ready;

      let retVal;
      if (isSqlite3(this.options.knex)) {
        // sqlite optimized query
        retVal = await this.options.knex.raw(
          getSqliteFastQuery(this.options.tablename, this.options.sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (
        isPostgres(this.options.knex) &&
        parseFloat(this.options.knex.client.version) >= 9.2
      ) {
        // postgresql optimized query
        retVal = await this.options.knex.raw(
          getPostgresFastQuery(this.options.tablename, this.options.sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (isMySQL(this.options.knex)) {
        retVal = await this.options.knex.raw(
          getMysqlFastQuery(this.options.tablename, this.options.sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (isMSSQL(this.options.knex)) {
        retVal = await this.options.knex.raw(
          getMssqlFastQuery(this.options.tablename, this.options.sidfieldname),
          [sid, dbDate, sess],
        );
      } else {
        retVal = await this.options.knex.transaction(async (trx) => {
          const foundKeys = await trx
            .select("*")
            .forUpdate()
            .from(this.options.tablename)
            .where(this.options.sidfieldname, "=", sid);

          if (foundKeys.length === 0) {
            await trx.from(this.options.tablename).insert({
              [this.options.sidfieldname]: sid,
              expired: dbDate,
              sess,
            });
          } else {
            await trx(this.options.tablename)
              .where(this.options.sidfieldname, "=", sid)
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
      const condition = expiredCondition(this.options.knex);

      const retVal = await this.options.knex(this.options.tablename)
        .where(this.options.sidfieldname, "=", sid)
        .andWhereRaw(condition, dateAsISO(this.options.knex))
        .update({
          expired: dateAsISO(this.options.knex, session.cookie.expires),
        });

      callback?.();
      return retVal;
    }

    return null;
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    await this.ready;
    try {
      const retVal = await this.options.knex
        .del()
        .from(this.options.tablename)
        .where(this.options.sidfieldname, "=", sid);
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
      const response = await this.options.knex
        .count(`${this.options.sidfieldname} as count`)
        .from(this.options.tablename);

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
      const res = await this.options.knex.del().from(this.options.tablename);
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
      const condition = expiredCondition(this.options.knex);
      const rows = await this.options.knex
        .select("sess")
        .from(this.options.tablename)
        .whereRaw(condition, dateAsISO(this.options.knex));

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

  async queueNextDbCleanup() {
    await this.ready;
    try {
      let condition = `expired < CAST(? as ${timestampTypeName(this.options.knex)})`;
      if (isSqlite3(this.options.knex)) {
        // sqlite3 date condition is a special case.
        condition = "datetime(expired) < datetime(?)";
      } else if (isOracle(this.options.knex)) {
        condition = `"expired" < CAST(? as ${timestampTypeName(this.options.knex)})`;
      }
      await this.options
        .knex(this.options.tablename)
        .del()
        .whereRaw(condition, dateAsISO(this.options.knex));
    } catch (err: unknown) {
      this.options.onDbCleanupError?.(err);
    } finally {
      this.nextDbCleanup = setTimeout(() => {
        this.queueNextDbCleanup();
      }, this.options.clearInterval)
        .unref();
    }
  }

  stopDbCleanup() {
    if (this.nextDbCleanup) {
      clearTimeout(this.nextDbCleanup);
      delete this.nextDbCleanup;
    }
  }

  getNextDbCleanup() {
    return this.nextDbCleanup;
  }
}
