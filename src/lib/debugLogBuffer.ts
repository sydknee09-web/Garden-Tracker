export type DebugLogLevel = "log" | "warn" | "error";

export type DebugLogEntry = {
  ts: string;
  level: DebugLogLevel;
  message: string;
};

const STORAGE_KEY = "garden-tracker-debug-log";
const MAX_ENTRIES = 500;

let installed = false;
const originals: Partial<Record<DebugLogLevel, (...args: unknown[]) => void>> = {};

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return `${value.name}: ${value.message}${value.stack ? "\n" + value.stack : ""}`;
  try {
    return JSON.stringify(value);
  } catch {
    return "[non-serializable]";
  }
}

function formatArgs(args: unknown[]): string {
  return args.map(safeStringify).join(" ");
}

function readBuffer(): DebugLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown): e is DebugLogEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as DebugLogEntry).ts === "string" &&
        typeof (e as DebugLogEntry).level === "string" &&
        typeof (e as DebugLogEntry).message === "string"
    );
  } catch {
    return [];
  }
}

function writeBuffer(entries: DebugLogEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage unavailable / quota — fall back silently to in-memory only via memBuffer
  }
}

let memBuffer: DebugLogEntry[] = [];

export function pushEntry(level: DebugLogLevel, args: unknown[]): void {
  const entry: DebugLogEntry = {
    ts: new Date().toISOString(),
    level,
    message: formatArgs(args),
  };
  const current = readBuffer();
  const next = [...(current.length > 0 ? current : memBuffer), entry].slice(-MAX_ENTRIES);
  memBuffer = next;
  writeBuffer(next);
}

export function getEntries(): DebugLogEntry[] {
  const persisted = readBuffer();
  return persisted.length > 0 ? persisted : memBuffer;
}

export function clearEntries(): void {
  memBuffer = [];
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export function installConsoleCapture(): void {
  if (installed) return;
  if (typeof window === "undefined") return;
  installed = true;

  const levels: DebugLogLevel[] = ["log", "warn", "error"];
  for (const level of levels) {
    const original = window.console[level] as (...args: unknown[]) => void;
    originals[level] = original;
    window.console[level] = ((...args: unknown[]) => {
      try {
        pushEntry(level, args);
      } catch {
        // never let logging crash the app
      }
      original.apply(window.console, args);
    }) as typeof window.console.log;
  }
}

export function uninstallConsoleCapture(): void {
  if (!installed) return;
  const levels: DebugLogLevel[] = ["log", "warn", "error"];
  for (const level of levels) {
    const original = originals[level];
    if (original) {
      window.console[level] = original as typeof window.console.log;
    }
  }
  installed = false;
}

export function formatEntriesForCopy(entries: DebugLogEntry[]): string {
  return entries
    .slice()
    .reverse()
    .map((e) => {
      const t = e.ts.slice(11, 19);
      return `[${t}] [${e.level.toUpperCase()}] ${e.message}`;
    })
    .join("\n");
}

// Exported for tests
export const __test__ = { MAX_ENTRIES, STORAGE_KEY };
