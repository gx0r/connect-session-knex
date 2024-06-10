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
    constructor(_options) {
        super();
        const options = this.options = {
            clearInterval: 60000,
            createtable: true,
            disableDbCleanup: false,
            sidfieldname: "sid",
            tablename: "sessions",
            onDbCleanupError: (err) => {
                console.error(err);
            },
            ..._options,
            knex: _options.knex ??
                (0, knex_1.default)({
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
                    (0, utils_1.isDbSupportJSON)(knex).then((isSupport) => knex.schema.createTable(tablename, (table) => {
                        table.string(sidfieldname).primary();
                        if (isSupport) {
                            table.json("sess").notNullable();
                        }
                        else {
                            table.text("sess").notNullable();
                        }
                        if ((0, utils_1.isMySQL)(knex) || (0, utils_1.isMSSQL)(knex)) {
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
            const { knex, tablename, sidfieldname } = this.options;
            const condition = (0, utils_1.expiredCondition)(knex);
            const response = await knex
                .select("sess")
                .from(tablename)
                .where(sidfieldname, "=", sid)
                .andWhereRaw(condition, (0, utils_1.dateAsISO)(knex));
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
        const { knex, tablename, sidfieldname } = this.options;
        const { maxAge } = session.cookie;
        const now = new Date().getTime();
        const expired = maxAge ? now + maxAge : now + 86400000; // 86400000 = add one day
        const sess = JSON.stringify(session);
        const dbDate = (0, utils_1.dateAsISO)(knex, expired);
        try {
            await this.ready;
            let retVal;
            if ((0, utils_1.isSqlite3)(knex)) {
                // sqlite optimized query
                retVal = await knex.raw((0, utils_1.getSqliteFastQuery)(tablename, sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isPostgres)(knex) &&
                parseFloat(knex.client.version) >= 9.2) {
                // postgresql optimized query
                retVal = await knex.raw((0, utils_1.getPostgresFastQuery)(tablename, sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMySQL)(knex)) {
                retVal = await knex.raw((0, utils_1.getMysqlFastQuery)(tablename, sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMSSQL)(knex)) {
                retVal = await knex.raw((0, utils_1.getMssqlFastQuery)(tablename, sidfieldname), [sid, dbDate, sess]);
            }
            else {
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
                    }
                    else {
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
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async touch(sid, session, callback) {
        const { knex, tablename, sidfieldname } = this.options;
        if (session && session.cookie && session.cookie.expires) {
            const condition = (0, utils_1.expiredCondition)(knex);
            const retVal = await knex(tablename)
                .where(sidfieldname, "=", sid)
                .andWhereRaw(condition, (0, utils_1.dateAsISO)(knex))
                .update({
                expired: (0, utils_1.dateAsISO)(knex, session.cookie.expires),
            });
            callback?.();
            return retVal;
        }
        return null;
    }
    async destroy(sid, callback) {
        const { knex, tablename, sidfieldname } = this.options;
        await this.ready;
        try {
            const retVal = await knex
                .del()
                .from(tablename)
                .where(sidfieldname, "=", sid);
            callback?.(null);
            return retVal;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async length(callback) {
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
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async clear(callback) {
        const { knex, tablename } = this.options;
        try {
            await this.ready;
            const res = await knex.del().from(tablename);
            callback?.(null);
            return res;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async all(callback) {
        const { knex, tablename } = this.options;
        await this.ready;
        try {
            const condition = (0, utils_1.expiredCondition)(knex);
            const rows = await knex
                .select("sess")
                .from(tablename)
                .whereRaw(condition, (0, utils_1.dateAsISO)(knex));
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
        const { knex, tablename, sidfieldname } = this.options;
        await this.ready;
        try {
            let condition = `expired < CAST(? as ${(0, utils_1.timestampTypeName)(knex)})`;
            if ((0, utils_1.isSqlite3)(knex)) {
                // sqlite3 date condition is a special case.
                condition = "datetime(expired) < datetime(?)";
            }
            else if ((0, utils_1.isOracle)(knex)) {
                condition = `"expired" < CAST(? as ${(0, utils_1.timestampTypeName)(knex)})`;
            }
            await this.options
                .knex(tablename)
                .del()
                .whereRaw(condition, (0, utils_1.dateAsISO)(knex));
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