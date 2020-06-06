import * as Knex from 'knex';
import expressSession, { Store } from 'express-session';

declare module 'connect-session-knex' {
    type ConfigType = {
        tablename?: string;
        sidfieldname?: string;
        knex?: Knex;
        createTable?: boolean;
        clearInterval?: number;
    };

    interface StoreFactory {
        new (configs?: ConfigType): Store;
    }

    export default function initFunction(session: typeof expressSession): StoreFactory;
}
