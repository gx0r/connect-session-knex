"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expiredCondition = exports.timestampTypeName = exports.getMssqlFastQuery = exports.getMysqlFastQuery = exports.getSqliteFastQuery = exports.getPostgresFastQuery = exports.dateAsISO = exports.isDbSupportJSON = exports.isOracle = exports.isPostgres = exports.isMSSQL = exports.isMySQL = exports.isSqlite3 = void 0;
const isSqlite3 = (knex) => knex.client.dialect === "sqlite3";
exports.isSqlite3 = isSqlite3;
const isMySQL = (knex) => ["mysql", "mariasql", "mariadb"].indexOf(knex.client.dialect) > -1;
exports.isMySQL = isMySQL;
const isMSSQL = (knex) => ["mssql"].indexOf(knex.client.dialect) > -1;
exports.isMSSQL = isMSSQL;
const isPostgres = (knex) => ["postgresql"].indexOf(knex.client.dialect) > -1;
exports.isPostgres = isPostgres;
const isOracle = (knex) => ["oracle", "oracledb"].indexOf(knex.client.dialect) > -1;
exports.isOracle = isOracle;
/*
 * Returns true if the specified database supports JSON datatype.
 * @return {bool}
 * @api private
 */
async function isDbSupportJSON(knex) {
    if ((0, exports.isMSSQL)(knex))
        return false;
    if (!(0, exports.isMySQL)(knex))
        return true;
    const data = await knex.raw("select version() as version");
    const { version } = data[0][0];
    const extractedVersions = version.split(".");
    // Only mysql version > 5.7.8 supports JSON datatype
    return (+extractedVersions[0] > 5 ||
        (extractedVersions[0] === "5" &&
            (+extractedVersions[1] > 7 ||
                (+extractedVersions[1] === 7 && +extractedVersions[2] >= 8))));
}
exports.isDbSupportJSON = isDbSupportJSON;
/*
 * Return datastore appropriate string of the current time
 * @api private
 * @return {String | date}
 */
function dateAsISO(knex, aDate) {
    let date;
    if (aDate == null) {
        date = new Date();
    }
    else {
        if (typeof aDate === "number") {
            date = new Date(aDate);
        }
        else if (typeof aDate === "string") {
            date = new Date(aDate);
        }
        else {
            date = aDate;
        }
    }
    if ((0, exports.isOracle)(knex)) {
        return date;
    }
    return (0, exports.isMySQL)(knex) || (0, exports.isMSSQL)(knex)
        ? date.toISOString().slice(0, 19).replace("T", " ")
        : date.toISOString();
}
exports.dateAsISO = dateAsISO;
/*
 * Returns PostgreSQL fast upsert query.
 * @return {string}
 * @api private
 */
function getPostgresFastQuery(tablename, sidfieldname) {
    return (`with new_values (${sidfieldname}, expired, sess) as (` +
        "  values (?, ?::timestamp with time zone, ?::json)" +
        "), " +
        "upsert as " +
        "( " +
        `  update "${tablename}" cs set ` +
        `    ${sidfieldname} = nv.${sidfieldname}, ` +
        "    expired = nv.expired, " +
        "    sess = nv.sess " +
        "  from new_values nv " +
        `  where cs.${sidfieldname} = nv.${sidfieldname} ` +
        "  returning cs.* " +
        ")" +
        `insert into "${tablename}" (${sidfieldname}, expired, sess) ` +
        `select ${sidfieldname}, expired, sess ` +
        "from new_values " +
        `where not exists (select 1 from upsert up where up.${sidfieldname} = new_values.${sidfieldname})`);
}
exports.getPostgresFastQuery = getPostgresFastQuery;
/*
 * Returns SQLite fast upsert query.
 * @return {string}
 * @api private
 */
function getSqliteFastQuery(tablename, sidfieldname) {
    return `insert or replace into ${tablename} (${sidfieldname}, expired, sess) values (?, ?, ?);`;
}
exports.getSqliteFastQuery = getSqliteFastQuery;
/*
 * Returns MySQL fast upsert query.
 * @return {string}
 * @api private
 */
function getMysqlFastQuery(tablename, sidfieldname) {
    return `insert into ${tablename} (${sidfieldname}, expired, sess) values (?, ?, ?) on duplicate key update expired=values(expired), sess=values(sess);`;
}
exports.getMysqlFastQuery = getMysqlFastQuery;
/*
 * Returns MSSQL fast upsert query.
 * @return {string}
 * @api private
 */
function getMssqlFastQuery(tablename, sidfieldname) {
    return (`merge ${tablename} as T ` +
        `using (values (?, ?, ?)) as S (${sidfieldname}, expired, sess) ` +
        `on (T.${sidfieldname} = S.${sidfieldname}) ` +
        "when matched then " +
        "update set expired = S.expired, sess = S.sess " +
        "when not matched by target then " +
        `insert (${sidfieldname}, expired, sess) values (S.${sidfieldname}, S.expired, S.sess) ` +
        "output inserted.*;");
}
exports.getMssqlFastQuery = getMssqlFastQuery;
/*
 * Return dialect-aware type name for timestamp
 * @return {String} type name for timestamp
 * @api private
 */
function timestampTypeName(knex) {
    return (0, exports.isMySQL)(knex) || (0, exports.isMSSQL)(knex)
        ? "DATETIME"
        : (0, exports.isPostgres)(knex)
            ? "timestamp with time zone"
            : "timestamp";
}
exports.timestampTypeName = timestampTypeName;
/*
 * Return condition for filtering by expiration
 * @return {String} expired sql condition string
 * @api private
 */
function expiredCondition(knex) {
    let condition = `CAST(? as ${timestampTypeName(knex)}) <= expired`;
    if ((0, exports.isSqlite3)(knex)) {
        // sqlite3 date condition is a special case.
        condition = "datetime(?) <= datetime(expired)";
    }
    else if ((0, exports.isOracle)(knex)) {
        condition = `CAST(? as ${timestampTypeName(knex)}) <= "expired"`;
    }
    return condition;
}
exports.expiredCondition = expiredCondition;
//# sourceMappingURL=utils.js.map