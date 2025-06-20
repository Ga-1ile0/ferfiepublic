export const devLog = {
    log: (...args: any[]) => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('', ...args);
        }
    },
    warn: (...args: any[]) => {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('', ...args);
        }
    },
    error: (...args: any[]) => {
        // Always log errors, even in production
        console.error('', ...args);
    }
};
