declare module 'wav' {
    import { Readable, Writable } from 'stream';

    export class Reader extends Readable {
        constructor(options?: any);
    }

    export class Writer extends Writable {
        constructor(options?: any);
    }

    export class FileWriter extends Writer {
        constructor(path: string, options?: any);
    }
}
