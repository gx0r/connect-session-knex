import knexConstructor, { Knex } from "knex";
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

  constructor(_options: Partial<Options>) {
    super();

    const options = this.options = {
      clearInterval: 60000,
      createtable: true,
      disableDbCleanup: false,
      sidfieldname: "sid",
      tablename: "sessions",
      onDbCleanupError: (err: unknown) => {
        console.error(err);
      },
      ..._options,
      knex:
        _options.knex ??
        knexConstructor({
          client: "sqlite3",
          connection: {
            filename: "connect-session-knex.sqlite",
          },
        }),
    };

    const { createtable, knex, sidfieldname, tablename } = options;

    this.ready = knex.schema
      .hasTable(tablename)
      .then((exists) => {
        if (!exists && createtable) {
          return new Promise((res) => {
            isDbSupportJSON(knex).then((isSupport) =>
              knex.schema.createTable(tablename, (table) => {
                table.string(sidfieldname).primary();
                if (isSupport) {
                  table.json("sess").notNullable();
                } else {
                  table.text("sess").notNullable();
                }
                if (isMySQL(knex) || isMSSQL(knex)) {
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
      const { knex, tablename, sidfieldname } = this.options;
      const condition = expiredCondition(knex);

      const response = await knex
        .select("sess")
        .from(tablename)
        .where(sidfieldname, "=", sid)
        .andWhereRaw(condition, dateAsISO(knex));

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
    const { knex, tablename, sidfieldname } = this.options;
    const { maxAge } = session.cookie;
    const now = new Date().getTime();
    const expired = maxAge ? now + maxAge : now + 86400000; // 86400000 = add one day
    const sess = JSON.stringify(session);

    const dbDate = dateAsISO(knex, expired);

    try {
      await this.ready;

      let retVal;
      if (isSqlite3(knex)) {
        // sqlite optimized query
        retVal = await knex.raw(
          getSqliteFastQuery(tablename, sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (
        isPostgres(knex) &&
        parseFloat(knex.client.version) >= 9.2
      ) {
        // postgresql optimized query
        retVal = await knex.raw(
          getPostgresFastQuery(tablename, sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (isMySQL(knex)) {
        retVal = await knex.raw(
          getMysqlFastQuery(tablename, sidfieldname),
          [sid, dbDate, sess],
        );
      } else if (isMSSQL(knex)) {
        retVal = await knex.raw(
          getMssqlFastQuery(tablename, sidfieldname),
          [sid, dbDate, sess],
        );
      } else {
        retVal = await knex.transaction(async (trx) => {
          const foundKeys = await trx
            .select("*")
            .forUpdate()
            .from(tablename)
            .where(sidfieldname, "=", sid);

          if (foundKeys.length === 0) {
            await trx.from(tablename).insert({
              [sidfieldname]: sid,
              expired: dbDate,
              sess,
            });
          } else {
            await trx(tablename)
              .where(sidfieldname, "=", sid)
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
    const { knex, tablename, sidfieldname } = this.options;

    if (session && session.cookie && session.cookie.expires) {
      const condition = expiredCondition(knex);

      const retVal = await knex(tablename)
        .where(sidfieldname, "=", sid)
        .andWhereRaw(condition, dateAsISO(knex))
        .update({
          expired: dateAsISO(knex, session.cookie.expires),
        });

      callback?.();
      return retVal;
    }

    return null;
  }

  async destroy(sid: string, callback?: (err?: any) => void) {
    const { knex, tablename, sidfieldname } = this.options;
    await this.ready;

    try {
      const retVal = await knex
        .del()
        .from(tablename)
        .where(sidfieldname, "=", sid);
      callback?.(null);
      return retVal;
    } catch (err) {
      callback?.(err);
      throw err;
    }
  }

  async length(callback: (err: any, length?: number) => void) {
    const { knex, tablename, sidfieldname } = this.options;
    await this.ready;

    try {
      let retVal;
      const response = await knex
        .count(`${sidfieldname} as count`)
        .from(tablename);

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
    const { knex, tablename } = this.options;

    try {
      await this.ready;
      const res = await knex.del().from(tablename);
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
    const { knex, tablename } = this.options;
    await this.ready;

    try {
      const condition = expiredCondition(knex);
      const rows = await knex
        .select("sess")
        .from(tablename)
        .whereRaw(condition, dateAsISO(knex));

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
    const { knex, tablename, sidfieldname } = this.options;
    await this.ready;

    try {
      let condition = `expired < CAST(? as ${timestampTypeName(knex)})`;
      if (isSqlite3(knex)) {
        // sqlite3 date condition is a special case.
        condition = "datetime(expired) < datetime(?)";
      } else if (isOracle(knex)) {
        condition = `"expired" < CAST(? as ${timestampTypeName(knex)})`;
      }
      await this.options
        .knex(tablename)
        .del()
        .whereRaw(condition, dateAsISO(knex));
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
