export const logger = {
    level: process.env.LOG_LEVEL || 'info',
    log: (lvl: string, ...args: any[]) => {
        const levels = ['debug', 'info', 'warn', 'error'];
        if (levels.indexOf(lvl) >= levels.indexOf(logger.level)) {
            (console as any)[lvl](...args);
        }
    },
    debug: (...args: any[]) => logger.log('debug', ...args),
    info: (...args: any[]) => logger.log('info', ...args),
    warn: (...args: any[]) => logger.log('warn', ...args),
    error: (...args: any[]) => logger.log('error', ...args),
};
