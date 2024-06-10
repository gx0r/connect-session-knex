"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectSessionKnexStore = void 0;
const knex_1 = __importDefault(require("knex"));
const express_session_1 = require("express-session");
const utils_1 = require("./utils");
class ConnectSessionKnexStore extends express_session_1.Store {
    ONE_DAY = 86400000;
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
                (0, knex_1.default)({
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
                    (0, utils_1.isDbSupportJSON)(self.knex).then((isSupport) => self.knex.schema.createTable(self.tablename, (table) => {
                        table.string(self.sidfieldname).primary();
                        if (isSupport) {
                            table.json("sess").notNullable();
                        }
                        else {
                            table.text("sess").notNullable();
                        }
                        if ((0, utils_1.isMySQL)(self.knex) || (0, utils_1.isMSSQL)(self.knex)) {
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
            const condition = (0, utils_1.expiredCondition)(this.knex);
            const response = await this.knex
                .select("sess")
                .from(this.tablename)
                .where(this.sidfieldname, "=", sid)
                .andWhereRaw(condition, (0, utils_1.dateAsISO)(this.knex));
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
        const expired = maxAge ? now + maxAge : now + this.ONE_DAY;
        const sess = JSON.stringify(session);
        const dbDate = (0, utils_1.dateAsISO)(self.knex, expired);
        try {
            await this.ready;
            let retVal;
            if ((0, utils_1.isSqlite3)(self.knex)) {
                // sqlite optimized query
                retVal = await self.knex.raw((0, utils_1.getSqliteFastQuery)(self.tablename, self.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isPostgres)(self.knex) &&
                parseFloat(self.knex.client.version) >= 9.2) {
                // postgresql optimized query
                retVal = await self.knex.raw((0, utils_1.getPostgresFastQuery)(self.tablename, self.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMySQL)(self.knex)) {
                retVal = await self.knex.raw((0, utils_1.getMysqlFastQuery)(self.tablename, self.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMSSQL)(self.knex)) {
                retVal = await self.knex.raw((0, utils_1.getMssqlFastQuery)(self.tablename, self.sidfieldname), [sid, dbDate, sess]);
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
            const condition = (0, utils_1.expiredCondition)(this.knex);
            const retVal = await this.knex(this.tablename)
                .where(this.sidfieldname, "=", sid)
                .andWhereRaw(condition, (0, utils_1.dateAsISO)(this.knex))
                .update({
                expired: (0, utils_1.dateAsISO)(this.knex, session.cookie.expires),
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
            const condition = (0, utils_1.expiredCondition)(this.knex);
            const rows = await this.knex
                .select("sess")
                .from(this.tablename)
                .whereRaw(condition, (0, utils_1.dateAsISO)(this.knex));
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
            let condition = `expired < CAST(? as ${(0, utils_1.timestampTypeName)(store.knex)})`;
            if ((0, utils_1.isSqlite3)(store.knex)) {
                // sqlite3 date condition is a special case.
                condition = "datetime(expired) < datetime(?)";
            }
            else if ((0, utils_1.isOracle)(store.knex)) {
                condition = `"expired" < CAST(? as ${(0, utils_1.timestampTypeName)(store.knex)})`;
            }
            await store
                .knex(store.tablename)
                .del()
                .whereRaw(condition, (0, utils_1.dateAsISO)(store.knex));
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
exports.ConnectSessionKnexStore = ConnectSessionKnexStore;
//# sourceMappingURL=index.js.map