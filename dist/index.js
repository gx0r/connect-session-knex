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
    options;
    nextDbCleanup;
    ready;
    constructor(options) {
        super();
        this.options = {
            clearInterval: 60000,
            createtable: true,
            disableDbCleanup: false,
            sidfieldname: "sid",
            tablename: "sessions",
            onDbCleanupError: (err) => {
                console.error(err);
            },
            ...options,
            knex: options.knex ??
                (0, knex_1.default)({
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
                    (0, utils_1.isDbSupportJSON)(this.options.knex).then((isSupport) => this.options.knex.schema.createTable(this.options.tablename, (table) => {
                        table.string(this.options.sidfieldname).primary();
                        if (isSupport) {
                            table.json("sess").notNullable();
                        }
                        else {
                            table.text("sess").notNullable();
                        }
                        if ((0, utils_1.isMySQL)(this.options.knex) || (0, utils_1.isMSSQL)(this.options.knex)) {
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
                this.queueNextDbCleanup();
            }
            return null;
        });
    }
    async get(sid, callback) {
        try {
            await this.ready;
            const condition = (0, utils_1.expiredCondition)(this.options.knex);
            const response = await this.options.knex
                .select("sess")
                .from(this.options.tablename)
                .where(this.options.sidfieldname, "=", sid)
                .andWhereRaw(condition, (0, utils_1.dateAsISO)(this.options.knex));
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
        const dbDate = (0, utils_1.dateAsISO)(this.options.knex, expired);
        try {
            await this.ready;
            let retVal;
            if ((0, utils_1.isSqlite3)(this.options.knex)) {
                // sqlite optimized query
                retVal = await this.options.knex.raw((0, utils_1.getSqliteFastQuery)(this.options.tablename, this.options.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isPostgres)(this.options.knex) &&
                parseFloat(this.options.knex.client.version) >= 9.2) {
                // postgresql optimized query
                retVal = await this.options.knex.raw((0, utils_1.getPostgresFastQuery)(this.options.tablename, this.options.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMySQL)(this.options.knex)) {
                retVal = await this.options.knex.raw((0, utils_1.getMysqlFastQuery)(this.options.tablename, this.options.sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMSSQL)(this.options.knex)) {
                retVal = await this.options.knex.raw((0, utils_1.getMssqlFastQuery)(this.options.tablename, this.options.sidfieldname), [sid, dbDate, sess]);
            }
            else {
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
                    }
                    else {
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
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async touch(sid, session, callback) {
        if (session && session.cookie && session.cookie.expires) {
            const condition = (0, utils_1.expiredCondition)(this.options.knex);
            const retVal = await this.options.knex(this.options.tablename)
                .where(this.options.sidfieldname, "=", sid)
                .andWhereRaw(condition, (0, utils_1.dateAsISO)(this.options.knex))
                .update({
                expired: (0, utils_1.dateAsISO)(this.options.knex, session.cookie.expires),
            });
            callback?.();
            return retVal;
        }
        return null;
    }
    async destroy(sid, callback) {
        await this.ready;
        try {
            const retVal = await this.options.knex
                .del()
                .from(this.options.tablename)
                .where(this.options.sidfieldname, "=", sid);
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
            const response = await this.options.knex
                .count(`${this.options.sidfieldname} as count`)
                .from(this.options.tablename);
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
            const res = await this.options.knex.del().from(this.options.tablename);
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
            const condition = (0, utils_1.expiredCondition)(this.options.knex);
            const rows = await this.options.knex
                .select("sess")
                .from(this.options.tablename)
                .whereRaw(condition, (0, utils_1.dateAsISO)(this.options.knex));
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
    async queueNextDbCleanup() {
        await this.ready;
        try {
            let condition = `expired < CAST(? as ${(0, utils_1.timestampTypeName)(this.options.knex)})`;
            if ((0, utils_1.isSqlite3)(this.options.knex)) {
                // sqlite3 date condition is a special case.
                condition = "datetime(expired) < datetime(?)";
            }
            else if ((0, utils_1.isOracle)(this.options.knex)) {
                condition = `"expired" < CAST(? as ${(0, utils_1.timestampTypeName)(this.options.knex)})`;
            }
            await this.options
                .knex(this.options.tablename)
                .del()
                .whereRaw(condition, (0, utils_1.dateAsISO)(this.options.knex));
        }
        catch (err) {
            this.options.onDbCleanupError?.(err);
        }
        finally {
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
exports.ConnectSessionKnexStore = ConnectSessionKnexStore;
//# sourceMappingURL=index.js.map