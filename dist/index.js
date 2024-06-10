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
    clearInterval = 60000;
    createtable = true;
    disableDbCleanup = false;
    knex;
    nextDbCleanup;
    ready;
    sidfieldname = "sid";
    tablename = "sessions";
    onDbCleanupError = (_) => { };
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
        if (options.onDbCleanupError) {
            this.onDbCleanupError = options.onDbCleanupError;
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
        this.ready = this.knex.schema
            .hasTable(this.tablename)
            .then((exists) => {
            if (!exists && this.createtable) {
                return new Promise((res) => {
                    (0, utils_1.isDbSupportJSON)(this.knex).then((isSupport) => this.knex.schema.createTable(this.tablename, (table) => {
                        table.string(this.sidfieldname).primary();
                        if (isSupport) {
                            table.json("sess").notNullable();
                        }
                        else {
                            table.text("sess").notNullable();
                        }
                        if ((0, utils_1.isMySQL)(this.knex) || (0, utils_1.isMSSQL)(this.knex)) {
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
                this.setNextDbCleanup(this, this.clearInterval, this.onDbCleanupError);
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
        const { maxAge } = session.cookie;
        const now = new Date().getTime();
        const expired = maxAge ? now + maxAge : now + 86400000; // 86400000 = add one day
        const sess = JSON.stringify(session);
        const dbDate = (0, utils_1.dateAsISO)(this.knex, expired);
        try {
            await this.ready;
            let retVal;
            if ((0, utils_1.isSqlite3)(this.knex)) {
                // sqlite optimized query
                retVal = await this.knex.raw((0, utils_1.getSqliteFastQuery)(this.tablename, this.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isPostgres)(this.knex) &&
                parseFloat(this.knex.client.version) >= 9.2) {
                // postgresql optimized query
                retVal = await this.knex.raw((0, utils_1.getPostgresFastQuery)(this.tablename, this.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMySQL)(this.knex)) {
                retVal = await this.knex.raw((0, utils_1.getMysqlFastQuery)(this.tablename, this.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMSSQL)(this.knex)) {
                retVal = await this.knex.raw((0, utils_1.getMssqlFastQuery)(this.tablename, this.sidfieldname), [sid, dbDate, sess]);
            }
            else {
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
                    }
                    else {
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
            let retVal;
            const response = await this.knex
                .count(`${this.sidfieldname} as count`)
                .from(this.tablename);
            if (response.length === 1 && "count" in response[0]) {
                retVal = +(response[0].count ?? 0);
            }
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
        return this.nextDbCleanup;
    }
}
exports.ConnectSessionKnexStore = ConnectSessionKnexStore;
//# sourceMappingURL=index.js.map