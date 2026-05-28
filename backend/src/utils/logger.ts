// Structured logger for the Verity backend.
// Uses console with JSON formatting in production, pretty in dev.

const isDev = process.env.NODE_ENV !== "production";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

function format(level: LogLevel, msg: string, meta?: Record<string, unknown>): LogEntry {
  return {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...meta,
  };
}

function write(entry: LogEntry) {
  if (isDev) {
    const color = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" }[entry.level];
    const reset = "\x1b[0m";
    const { level, msg, timestamp, ...rest } = entry;
    const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
    console.log(`${color}[${timestamp}] ${level.toUpperCase()}${reset} ${msg}${extra}`);
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write(format("debug", msg, meta)),
  info: (msg: string, meta?: Record<string, unknown>) => write(format("info", msg, meta)),
  warn: (msg: string, meta?: Record<string, unknown>) => write(format("warn", msg, meta)),
  error: (msg: string, meta?: Record<string, unknown>) => write(format("error", msg, meta)),
};
