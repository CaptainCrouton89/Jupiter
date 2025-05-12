// Simple console logger
export const logger = {
  info: (...args: any[]) => console.log("[SYNC_ACCOUNT_INFO]", ...args),
  warn: (...args: any[]) => console.warn("[SYNC_ACCOUNT_WARN]", ...args),
  error: (...args: any[]) => console.error("[SYNC_ACCOUNT_ERROR]", ...args),
  trace: (...args: any[]) => console.log("[SYNC_ACCOUNT_TRACE]", ...args), // Temporarily enable trace for debugging
};
