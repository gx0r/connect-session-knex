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
    ready; // Schema created
    constructor(incomingOptions) {
        super();
        const options = this.options = {
            cleanupInterval: 60000,
            createTable: true,
            sidFieldName: "sid",
            tableName: "sessions",
            onDbCleanupError: (err) => {
                console.error(err);
            },
            ...incomingOptions,
            knex: incomingOptions.knex ??
                (0, knex_1.default)({
                    client: "sqlite3",
                    connection: {
                        filename: "connect-session-knex.sqlite",
                    },
                }),
        };
        const { cleanupInterval, createTable: createtable, knex, sidFieldName: sidfieldname, tableName: tablename } = options;
        this.ready = (async () => {
            if (!(await knex.schema.hasTable(tablename))) {
                if (!createtable) {
                    throw new Error(`Missing ${tablename} table`);
                }
                const supportsJson = await (0, utils_1.isDbSupportJSON)(knex);
                await knex.schema.createTable(tablename, (table) => {
                    table.string(sidfieldname).primary();
                    if (supportsJson) {
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
                });
            }
            if (cleanupInterval > 0) {
                this.dbCleanup();
            }
        })();
    }
    async get(sid, callback) {
        try {
            await this.ready;
            const { knex, tableName: tablename, sidFieldName: sidfieldname } = this.options;
            const condition = (0, utils_1.expiredCondition)(knex);
            const response = await knex
                .select("sess")
                .from(tablename)
                .where(sidfieldname, "=", sid)
                .andWhereRaw(condition, (0, utils_1.dateAsISO)(knex));
            let session = null;
            if (response[0]) {
                session = response[0].sess;
                if (typeof session === "string") {
                    session = JSON.parse(session);
                }
            }
            callback?.(null, session);
            return session;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async set(sid, session, callback) {
        try {
            await this.ready;
            const { knex, tableName: tablename, sidFieldName: sidfieldname } = this.options;
            const { maxAge } = session.cookie;
            const now = new Date().getTime();
            const expired = maxAge ? now + maxAge : now + 86400000; // 86400000 = add one day
            const sess = JSON.stringify(session);
            const dbDate = (0, utils_1.dateAsISO)(knex, expired);
            if ((0, utils_1.isSqlite3)(knex)) {
                // sqlite optimized query
                await knex.raw((0, utils_1.getSqliteFastQuery)(tablename, sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isPostgres)(knex) &&
                parseFloat(knex.client.version) >= 9.2) {
                // postgresql optimized query
                await knex.raw((0, utils_1.getPostgresFastQuery)(tablename, sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMySQL)(knex)) {
                await knex.raw((0, utils_1.getMysqlFastQuery)(tablename, sidfieldname), [sid, dbDate, sess]);
            }
            else if ((0, utils_1.isMSSQL)(knex)) {
                await knex.raw((0, utils_1.getMssqlFastQuery)(tablename, sidfieldname), [sid, dbDate, sess]);
            }
            else {
                await knex.transaction(async (trx) => {
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
            callback?.();
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async touch(sid, session, callback) {
        await this.ready;
        const { knex, tableName: tablename, sidFieldName: sidfieldname } = this.options;
        if (session && session.cookie && session.cookie.expires) {
            const condition = (0, utils_1.expiredCondition)(knex);
            await knex(tablename)
                .where(sidfieldname, "=", sid)
                .andWhereRaw(condition, (0, utils_1.dateAsISO)(knex))
                .update({
                expired: (0, utils_1.dateAsISO)(knex, session.cookie.expires),
            });
        }
        callback?.();
    }
    async destroy(sid, callback) {
        try {
            await this.ready;
            const { knex, tableName: tablename, sidFieldName: sidfieldname } = this.options;
            const retVal = await knex
                .del()
                .from(tablename)
                .where(sidfieldname, "=", sid);
            callback?.();
            return retVal;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async length(callback) {
        try {
            await this.ready;
            const { knex, tableName: tablename, sidFieldName: sidfieldname } = this.options;
            let length;
            const response = await knex
                .count(`${sidfieldname} as count`)
                .from(tablename);
            if (response.length === 1 && "count" in response[0]) {
                length = +(response[0].count ?? 0);
            }
            callback?.(null, length);
            return length;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async clear(callback) {
        try {
            await this.ready;
            const { knex, tableName: tablename } = this.options;
            const res = await knex.del().from(tablename);
            callback?.();
            return res;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async all(callback) {
        try {
            await this.ready;
            const { knex, tableName: tablename } = this.options;
            const condition = (0, utils_1.expiredCondition)(knex);
            const rows = await knex
                .select("sess")
                .from(tablename)
                .whereRaw(condition, (0, utils_1.dateAsISO)(knex));
            const sessions = rows.map((row) => {
                if (typeof row.sess === "string") {
                    return JSON.parse(row.sess);
                }
                return row.sess;
            });
            callback?.(undefined, sessions);
            return sessions;
        }
        catch (err) {
            callback?.(err);
            throw err;
        }
    }
    async dbCleanup() {
        const { cleanupInterval, knex, tableName: tablename, onDbCleanupError } = this.options;
        try {
            await this.ready;
            let condition = `expired < CAST(? as ${(0, utils_1.timestampTypeName)(knex)})`;
            if ((0, utils_1.isSqlite3)(knex)) {
                condition = "datetime(expired) < datetime(?)";
            }
            else if ((0, utils_1.isOracle)(knex)) {
                condition = `"expired" < CAST(? as ${(0, utils_1.timestampTypeName)(knex)})`;
            }
            await knex(tablename)
                .del()
                .whereRaw(condition, (0, utils_1.dateAsISO)(knex));
        }
        catch (err) {
            onDbCleanupError?.(err);
        }
        finally {
            if (cleanupInterval > 0) {
                this.nextDbCleanup = setTimeout(() => {
                    this.dbCleanup();
                }, cleanupInterval)
                    .unref();
            }
        }
    }
}
exports.ConnectSessionKnexStore = ConnectSessionKnexStore;
//# sourceMappingURL=index.js.map