/**
 * Structured Operational & Security Logger for HackTrack.
 * Produces structured ISO-timestamped JSON logs with correlation IDs and log levels.
 */

export type LogLevel = "INFO" | "WARN" | "ERROR" | "SECURITY";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  userId?: string;
  role?: string;
  ip?: string;
  endpoint?: string;
  details?: Record<string, any>;
}

// In-memory buffer of recent logs for test verification & health reporting
const memoryLogBuffer: LogEntry[] = [];
const MAX_LOG_BUFFER_SIZE = 500;

export function recordLog(entry: Omit<LogEntry, "timestamp">): LogEntry {
  const fullEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  memoryLogBuffer.push(fullEntry);
  if (memoryLogBuffer.length > MAX_LOG_BUFFER_SIZE) {
    memoryLogBuffer.shift();
  }

  // Format single-line JSON log in production
  if (process.env.NODE_ENV !== "test") {
    const serialized = JSON.stringify(fullEntry);
    if (entry.level === "ERROR" || entry.level === "SECURITY") {
      console.error(serialized);
    } else if (entry.level === "WARN") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  return fullEntry;
}

export const logger = {
  info: (message: string, meta?: Partial<Omit<LogEntry, "timestamp" | "level" | "message">>) =>
    recordLog({ level: "INFO", message, ...meta }),

  warn: (message: string, meta?: Partial<Omit<LogEntry, "timestamp" | "level" | "message">>) =>
    recordLog({ level: "WARN", message, ...meta }),

  error: (message: string, meta?: Partial<Omit<LogEntry, "timestamp" | "level" | "message">>) =>
    recordLog({ level: "ERROR", message, ...meta }),

  security: (message: string, meta?: Partial<Omit<LogEntry, "timestamp" | "level" | "message">>) =>
    recordLog({ level: "SECURITY", message, ...meta }),

  getRecentLogs: (limit: number = 50): LogEntry[] => {
    return memoryLogBuffer.slice(-limit);
  },

  clearLogs: () => {
    memoryLogBuffer.length = 0;
  },
};
