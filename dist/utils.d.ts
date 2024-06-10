import { Knex } from "knex";
export declare const isSqlite3: (knex: Knex) => boolean;
export declare const isMySQL: (knex: Knex) => boolean;
export declare const isMSSQL: (knex: Knex) => boolean;
export declare const isPostgres: (knex: Knex) => boolean;
export declare const isOracle: (knex: Knex) => boolean;
export declare function isDbSupportJSON(knex: Knex): Promise<boolean>;
export declare function dateAsISO(knex: Knex, aDate?: number | string | Date): string | Date;
export declare function getPostgresFastQuery(tablename: string, sidfieldname: string): string;
export declare function getSqliteFastQuery(tablename: string, sidfieldname: string): string;
export declare function getMysqlFastQuery(tablename: string, sidfieldname: string): string;
export declare function getMssqlFastQuery(tablename: string, sidfieldname: string): string;
export declare function timestampTypeName(knex: Knex): "DATETIME" | "timestamp with time zone" | "timestamp";
export declare function expiredCondition(knex: Knex): string;
//# sourceMappingURL=utils.d.ts.map