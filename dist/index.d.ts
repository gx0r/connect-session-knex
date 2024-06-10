/// <reference types="node" />
import { Knex } from "knex";
import { SessionData, Store } from "express-session";
interface Options {
    cleanupInterval: number;
    createTable: boolean;
    knex: Knex;
    onDbCleanupError: (err: unknown) => void;
    tableName: string;
    sidFieldName: string;
}
export declare class ConnectSessionKnexStore extends Store {
    options: Options;
    nextDbCleanup: NodeJS.Timeout | undefined;
    ready: Promise<unknown>;
    constructor(incomingOptions: Partial<Options>);
    get(sid: string, callback: (err: any, session?: SessionData | null) => void): Promise<SessionData | null>;
    set(sid: string, session: SessionData, callback?: (err?: any) => void): Promise<void>;
    touch(sid: string, session: SessionData, callback?: () => void): Promise<void>;
    destroy(sid: string, callback?: (err?: any) => void): Promise<number>;
    length(callback: (err: any, length?: number) => void): Promise<number | undefined>;
    clear(callback?: (err?: any) => void): Promise<number>;
    all(callback: (err: any, obj?: SessionData[] | {
        [sid: string]: SessionData;
    } | null) => void): Promise<any[]>;
    private dbCleanup;
}
export {};
//# sourceMappingURL=index.d.ts.map