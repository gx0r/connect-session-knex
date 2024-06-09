import knex from "knex";
import { Store } from "express-session";
import { dateAsISO, getMssqlFastQuery, getPostgresFastQuery, getMysqlFastQuery, getSqliteFastQuery, isMSSQL, isPostgres, isMySQL, isOracle, isSqlite3, timestampTypeName, expiredCondition, isDbSupportJSON, } from "./utils";
const ONE_DAY = 86400000;
export class ConnectSessionKnexStore extends Store {
    clearInterval = 60000;
    createtable = true;
    disableDbCleanup = false;
    knex;
    nextDbCleanup;
    ready;
    sidfieldname = "sid";
    tablename = "sessions";
    constructor(options) {
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
        this.knex =
            options.knex ||
                knex({
                    client: "sqlite3",
                    // debug: true,
                    connection: {
                        filename: "connect-session-knex.sqlite",
                    },
                });
        const self = this;
        this.ready = this.knex.schema
            .hasTable(self.tablename)
            .then((exists) => {
            if (!exists && self.createtable) {
                return new Promise((res) => {
                    isDbSupportJSON(self.knex).then((isSupport) => self.knex.schema.createTable(self.tablename, (table) => {
                        table.string(self.sidfieldname).primary();
                        if (isSupport) {
                            table.json("sess").notNullable();
                        }
                        else {
                            table.text("sess").notNullable();
                        }
                        if (isMySQL(self.knex) || isMSSQL(self.knex)) {
                            table.dateTime("expired").notNullable().index();
                        }
                        else {
                            table.timestamp("expired").notNullable().index();
                        }
                        res(null);
                    }));
                });
            }
            return exists;
        })
            .then((exists) => {
            if (exists && !options.disableDbCleanup) {
                this.setNextDbCleanup(self, options.clearInterval, options.onDbCleanupError);
            }
            return null;
        });
    }
    async get(sid, callback) {
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
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async set(sid, session, callback) {
        const self = this;
        const { maxAge } = session.cookie;
        const now = new Date().getTime();
        const expired = maxAge ? now + maxAge : now + ONE_DAY;
        const sess = JSON.stringify(session);
        const dbDate = dateAsISO(self.knex, expired);
        try {
            await this.ready;
            let retVal;
            if (isSqlite3(self.knex)) {
                // sqlite optimized query
                retVal = await self.knex.raw(getSqliteFastQuery(self.tablename, self.sidfieldname), [sid, dbDate, sess]);
            }
            else if (isPostgres(self.knex) &&
                parseFloat(self.knex.client.version) >= 9.2) {
                // postgresql optimized query
                retVal = await self.knex.raw(getPostgresFastQuery(self.tablename, self.sidfieldname), [sid, dbDate, sess]);
            }
            else if (isMySQL(self.knex)) {
                retVal = await self.knex.raw(getMysqlFastQuery(self.tablename, self.sidfieldname), [sid, dbDate, sess]);
            }
            else if (isMSSQL(self.knex)) {
                retVal = await self.knex.raw(getMssqlFastQuery(self.tablename, self.sidfieldname), [sid, dbDate, sess]);
            }
            else {
                retVal = await self.knex.transaction((trx) => trx
                    .select("*")
                    .forUpdate()
                    .from(self.tablename)
                    .where(self.sidfieldname, "=", sid)
                    .then((foundKeys) => {
                    console.log(foundKeys);
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
                }));
            }
            callback?.(null);
            return retVal;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async touch(sid, session, callback) {
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
    async destroy(sid, callback) {
        await this.ready;
        try {
            const retVal = await this.knex
                .del()
                .from(this.tablename)
                .where(this.sidfieldname, "=", sid);
            callback?.(null);
            return retVal;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async length(callback) {
        await this.ready;
        try {
            const response = await this.knex
                .count(`${this.sidfieldname} as count`)
                .from(this.tablename);
            const retVal = response[0].count ?? 0;
            callback?.(null, retVal);
            return retVal;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async clear(callback) {
        try {
            await this.ready;
            const res = await this.knex.del().from(this.tablename);
            callback?.(null);
            return res;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async all(callback) {
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
        }
        catch (err) {
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
    async setNextDbCleanup(store, interval, callback) {
        await store.ready;
        try {
            let condition = `expired < CAST(? as ${timestampTypeName(store.knex)})`;
            if (isSqlite3(store.knex)) {
                // sqlite3 date condition is a special case.
                condition = "datetime(expired) < datetime(?)";
            }
            else if (isOracle(store.knex)) {
                condition = `"expired" < CAST(? as ${timestampTypeName(store.knex)})`;
            }
            await store
                .knex(store.tablename)
                .del()
                .whereRaw(condition, dateAsISO(store.knex));
        }
        catch (err) {
            callback?.(err);
        }
        finally {
            this.nextDbCleanup = setTimeout(this.setNextDbCleanup, interval, store, interval, callback).unref();
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
        return this.nextDbCleanup ? this.nextDbCleanup : null;
    }
}
//# sourceMappingURL=index.js.map