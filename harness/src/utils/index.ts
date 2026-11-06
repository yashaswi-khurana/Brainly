/**
 * Codebase Harness - Utility Functions
 *
 * Shared utilities for file system operations, hashing, path manipulation,
 * and other common operations used throughout the harness system.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, relative, resolve, basename, dirname, extname } from "path";
import { createHash } from "crypto";

/** Generate a deterministic ID from a string */
export function generateId(input: string): string {
  const hash = createHash("sha256").update(input).digest("hex");
  return hash.substring(0, 12);
}

/** Generate a human-readable slug from a path */
export function pathToSlug(path: string): string {
  return path
    .replace(/\//g, "-")
    .replace(/\./g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Recursively find files matching a pattern */
export async function findFiles(
  dir: string,
  patterns: RegExp[],
  maxDepth: number = 10,
  currentDepth: number = 0
): Promise<string[]> {
  if (currentDepth >= maxDepth) return [];

  const results: string[] = [];
  const IGNORED_DIRS = new Set([
    "node_modules", ".git", "dist", "build", ".next",
    ".turbo", "coverage", ".cache", "out", "target",
    ".output", ".parcel-cache", ".vite", ".svelte-kit",
    ".harness", "patches", "nix",
  ]);

  try {
    const entries = await readdir(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      try {
        const entryStat = await stat(fullPath);

        if (entryStat.isDirectory()) {
          if (IGNORED_DIRS.has(entry)) continue;
          if (entry.startsWith(".")) continue;
          const subFiles = await findFiles(fullPath, patterns, maxDepth, currentDepth + 1);
          results.push(...subFiles);
        } else if (entryStat.isFile()) {
          const matches = patterns.some((p) => p.test(entry));
          if (matches) results.push(fullPath);
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return results;
}

/** Count lines in a file */
export async function countLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

/** Get directory depth from root */
export function getDirectoryDepth(relativePath: string): number {
  if (!relativePath || relativePath === "." || relativePath === "") return 0;
  return relativePath.split("/").filter(Boolean).length;
}

/** Read and parse a JSON file */
export async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/** Get the file extension category */
export function getFileCategory(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const categories: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".json": "json",
    ".md": "markdown",
    ".css": "css",
    ".html": "html",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".sh": "shell",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".sql": "sql",
    ".graphql": "graphql",
    ".gql": "graphql",
  };
  return categories[ext] || "other";
}

/** Check if a path is a test file */
export function isTestFile(filePath: string): boolean {
  const name = basename(filePath).toLowerCase();
  return (
    name.includes(".test.") ||
    name.includes(".spec.") ||
    name.includes("_test.") ||
    name.includes("_spec.") ||
    filePath.includes("/test/") ||
    filePath.includes("/tests/") ||
    filePath.includes("/__tests__/")
  );
}

/** Extract entry points from package.json */
export function extractEntryPoints(pkg: Record<string, unknown>): string[] {
  const entries: string[] = [];

  if (pkg.bin) {
    const bin = pkg.bin as Record<string, string> | string;
    if (typeof bin === "string") {
      entries.push(bin);
    } else {
      entries.push(...Object.values(bin));
    }
  }

  if (pkg.main && typeof pkg.main === "string") {
    entries.push(pkg.main);
  }

  if (pkg.exports) {
    const exports = pkg.exports as Record<string, unknown>;
    for (const [key, value] of Object.entries(exports)) {
      if (typeof value === "string") {
        entries.push(value);
      } else if (typeof value === "object" && value !== null) {
        const conditions = value as Record<string, string>;
        if (conditions.import) entries.push(conditions.import);
        if (conditions.default) entries.push(conditions.default);
      }
    }
  }

  return [...new Set(entries)];
}

/** Format bytes to human-readable */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/** Debounce utility */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Create a formatted timestamp */
export function timestamp(): string {
  return new Date().toISOString();
}

/** Simple logger */
export class Logger {
  private level: "debug" | "info" | "warn" | "error";
  private prefix: string;

  constructor(prefix: string, level: "debug" | "info" | "warn" | "error" = "info") {
    this.prefix = prefix;
    this.level = level;
  }

  private shouldLog(level: string): boolean {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }

  debug(msg: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.log(`[${timestamp()}] [${this.prefix}] DEBUG: ${msg}`, ...args);
    }
  }

  info(msg: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.log(`[${timestamp()}] [${this.prefix}] INFO: ${msg}`, ...args);
    }
  }

  warn(msg: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(`[${timestamp()}] [${this.prefix}] WARN: ${msg}`, ...args);
    }
  }

  error(msg: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(`[${timestamp()}] [${this.prefix}] ERROR: ${msg}`, ...args);
    }
  }
}
