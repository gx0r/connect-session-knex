import { Knex } from 'knex';
import expressSession, { Store } from 'express-session';

declare module 'connect-session-knex' {
    type ConfigType = {
        tablename?: string;
        sidfieldname?: string;
        knex?: Knex;
        createtable?: boolean;
        clearInterval?: number;
        disableDbCleanup?: boolean;
    };

    interface StoreFactory {
        new (configs?: ConfigType): Store;
    }

    function initFunction(session: typeof expressSession): StoreFactory;
    export = initFunction;
}
