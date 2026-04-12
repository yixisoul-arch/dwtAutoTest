type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const redact = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
      .replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"***"');
  }

  return value;
};

const log = (level: LogLevel, message: string, meta?: unknown) => {
  const ts = new Date().toISOString();
  if (meta === undefined) {
    console[level](`[${ts}] [${level.toUpperCase()}] ${message}`);
    return;
  }

  console[level](`[${ts}] [${level.toUpperCase()}] ${message}`, redact(meta));
};

export const logger = {
  debug: (message: string, meta?: unknown) => log('debug', message, meta),
  info: (message: string, meta?: unknown) => log('info', message, meta),
  warn: (message: string, meta?: unknown) => log('warn', message, meta),
  error: (message: string, meta?: unknown) => log('error', message, meta),
};
