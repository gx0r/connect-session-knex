import { Knex } from "knex";

export const isSqlite3 = (knex: Knex) => knex.client.dialect === "sqlite3";
export const isMySQL = (knex: Knex) =>
  ["mysql", "mariasql", "mariadb"].indexOf(knex.client.dialect) > -1;
export const isMSSQL = (knex: Knex) =>
  ["mssql"].indexOf(knex.client.dialect) > -1;
export const isPostgres = (knex: Knex) =>
  ["postgresql"].indexOf(knex.client.dialect) > -1;
export const isOracle = (knex: Knex) =>
  ["oracle", "oracledb"].indexOf(knex.client.dialect) > -1;

/*
 * Returns true if the specified database supports JSON datatype.
 * @return {bool}
 * @api private
 */
export async function isDbSupportJSON(knex: Knex) {
  if (isMSSQL(knex)) return false;
  if (!isMySQL(knex)) return true;
  const data = await knex.raw("select version() as version");
  const { version } = data[0][0];
  const extractedVersions = version.split(".");
  // Only mysql version > 5.7.8 supports JSON datatype
  return (
    +extractedVersions[0] > 5 ||
    (extractedVersions[0] === "5" &&
      (+extractedVersions[1] > 7 ||
        (+extractedVersions[1] === 7 && +extractedVersions[2] >= 8)))
  );
}

/*
 * Return datastore appropriate string of the current time
 * @api private
 * @return {String | date}
 */
export function dateAsISO(
  knex: Knex,
  aDate?: number | string | Date,
): string | Date {
  let date;

  if (aDate == null) {
    date = new Date();
  } else {
    if (typeof aDate === "number") {
      date = new Date(aDate);
    } else if (typeof aDate === "string") {
      date = new Date(aDate);
    } else {
      date = aDate;
    }
  }

  if (isOracle(knex)) {
    return date;
  }
  return isMySQL(knex) || isMSSQL(knex)
    ? date.toISOString().slice(0, 19).replace("T", " ")
    : date.toISOString();
}

/*
 * Returns PostgreSQL fast upsert query.
 * @return {string}
 * @api private
 */
export function getPostgresFastQuery(tablename: string, sidfieldname: string) {
  return (
    `with new_values (${sidfieldname}, expired, sess) as (` +
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
    `where not exists (select 1 from upsert up where up.${sidfieldname} = new_values.${sidfieldname})`
  );
}

/*
 * Returns SQLite fast upsert query.
 * @return {string}
 * @api private
 */
export function getSqliteFastQuery(tablename: string, sidfieldname: string) {
  return `insert or replace into ${tablename} (${sidfieldname}, expired, sess) values (?, ?, ?);`;
}

/*
 * Returns MySQL fast upsert query.
 * @return {string}
 * @api private
 */
export function getMysqlFastQuery(tablename: string, sidfieldname: string) {
  return `insert into ${tablename} (${sidfieldname}, expired, sess) values (?, ?, ?) on duplicate key update expired=values(expired), sess=values(sess);`;
}

/*
 * Returns MSSQL fast upsert query.
 * @return {string}
 * @api private
 */
export function getMssqlFastQuery(tablename: string, sidfieldname: string) {
  return (
    `merge ${tablename} as T ` +
    `using (values (?, ?, ?)) as S (${sidfieldname}, expired, sess) ` +
    `on (T.${sidfieldname} = S.${sidfieldname}) ` +
    "when matched then " +
    "update set expired = S.expired, sess = S.sess " +
    "when not matched by target then " +
    `insert (${sidfieldname}, expired, sess) values (S.${sidfieldname}, S.expired, S.sess) ` +
    "output inserted.*;"
  );
}

/*
 * Return dialect-aware type name for timestamp
 * @return {String} type name for timestamp
 * @api private
 */
export function timestampTypeName(knex: Knex) {
  return isMySQL(knex) || isMSSQL(knex)
    ? "DATETIME"
    : isPostgres(knex)
      ? "timestamp with time zone"
      : "timestamp";
}

/*
 * Return condition for filtering by expiration
 * @return {String} expired sql condition string
 * @api private
 */
export function expiredCondition(knex: Knex) {
  let condition = `CAST(? as ${timestampTypeName(knex)}) <= expired`;
  if (isSqlite3(knex)) {
    // sqlite3 date condition is a special case.
    condition = "datetime(?) <= datetime(expired)";
  } else if (isOracle(knex)) {
    condition = `CAST(? as ${timestampTypeName(knex)}) <= "expired"`;
  }
  return condition;
}
