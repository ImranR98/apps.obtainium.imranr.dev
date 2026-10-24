export const defineMiddleware = <T extends (...args: any[]) => any>(handler: T): T => handler
