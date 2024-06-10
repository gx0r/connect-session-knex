/// <reference types="node" />
import { Knex } from "knex";
import { SessionData, Store } from "express-session";
interface Options {
    clearInterval: number;
    disableDbCleanup: boolean;
    createtable: boolean;
    knex: Knex;
    onDbCleanupError: (err: unknown) => void;
    tablename: string;
    sidfieldname: string;
}
export declare class ConnectSessionKnexStore extends Store {
    options: Options;
    nextDbCleanup: NodeJS.Timeout | undefined;
    ready: Promise<unknown>;
    constructor(_options: Partial<Options>);
    get(sid: string, callback: (err: any, session?: SessionData | null) => void): Promise<any>;
    set(sid: string, session: SessionData, callback?: (err?: any) => void): Promise<any>;
    touch?(sid: string, session: SessionData, callback?: () => void): Promise<number | null>;
    destroy(sid: string, callback?: (err?: any) => void): Promise<number>;
    length(callback: (err: any, length?: number) => void): Promise<number | undefined>;
    clear(callback?: (err?: any) => void): Promise<number>;
    all(callback: (err: any, obj?: SessionData[] | {
        [sid: string]: SessionData;
    } | null) => void): Promise<any[]>;
    queueNextDbCleanup(): Promise<void>;
    stopDbCleanup(): void;
    getNextDbCleanup(): NodeJS.Timeout | undefined;
}
export {};
//# sourceMappingURL=index.d.ts.map