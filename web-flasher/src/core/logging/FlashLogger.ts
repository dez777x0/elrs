export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
}

export type LogListener = (entry: LogEntry) => void;

function isoTs(): string {
  return new Date().toISOString();
}

export class FlashLogger {
  private readonly listeners = new Set<LogListener>();
  private readonly buffer: LogEntry[] = [];
  private maxBuffer = 2000;

  addListener(fn: LogListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setMaxBuffer(n: number): void {
    this.maxBuffer = Math.max(100, n);
    while (this.buffer.length > this.maxBuffer) this.buffer.shift();
  }

  getEntries(): readonly LogEntry[] {
    return this.buffer;
  }

  clear(): void {
    this.buffer.length = 0;
  }

  formatText(): string {
    return this.buffer.map((e) => `[${e.ts}] [${e.level.toUpperCase()}] [${e.scope}] ${e.message}`).join('\n');
  }

  child(scope: string): ScopedLogger {
    return new ScopedLogger(this, scope);
  }

  log(level: LogLevel, scope: string, message: string): void {
    const entry: LogEntry = { ts: isoTs(), level, scope, message };
    this.buffer.push(entry);
    while (this.buffer.length > this.maxBuffer) this.buffer.shift();
    for (const fn of this.listeners) {
      try {
        fn(entry);
      } catch {
        /* ignore listener errors */
      }
    }
  }
}

export class ScopedLogger {
  private readonly root: FlashLogger;
  private readonly scope: string;

  constructor(root: FlashLogger, scope: string) {
    this.root = root;
    this.scope = scope;
  }

  debug(msg: string): void {
    this.root.log('debug', this.scope, msg);
  }
  info(msg: string): void {
    this.root.log('info', this.scope, msg);
  }
  warn(msg: string): void {
    this.root.log('warn', this.scope, msg);
  }
  error(msg: string): void {
    this.root.log('error', this.scope, msg);
  }

  child(sub: string): ScopedLogger {
    return new ScopedLogger(this.root, `${this.scope}/${sub}`);
  }
}
