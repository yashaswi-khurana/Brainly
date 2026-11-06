/**
 * Codebase Harness - Codebase Indexer
 *
 * Analyzes and indexes each codebase within the monorepo. Detects:
 * - Technology stack (languages, frameworks, tools)
 * - Architecture patterns
 * - Dependencies and their categories
 * - Structural metrics
 * - Entry points and exports
 * - Test coverage
 * - Configuration patterns
 *
 * This index drives all downstream tool and skill generation.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, relative, basename, extname, dirname } from "path";
import type {
  CodebaseIndex,
  CodebaseType,
  TechStack,
  DependencyInfo,
  CodebaseMetrics,
  CodebasePatterns,
  ExportInfo,
  TestCoverageInfo,
} from "../types/index";
import {
  generateId,
  pathToSlug,
  findFiles,
  countLines,
  readJson,
  extractEntryPoints,
  isTestFile,
  getDirectoryDepth,
  Logger,
  timestamp,
} from "../utils/index";

const log = new Logger("CodebaseIndexer");

// ============================================================================
// Framework / Technology Detection Rules
// ============================================================================

interface DetectionRule {
  indicator: string;
  framework: string;
  category: "framework" | "build" | "test" | "lint" | "runtime" | "bundler";
}

const DETECTION_RULES: DetectionRule[] = [
  // Frameworks
  { indicator: "solid-js", framework: "SolidJS", category: "framework" },
  { indicator: "react", framework: "React", category: "framework" },
  { indicator: "next", framework: "Next.js", category: "framework" },
  { indicator: "astro", framework: "Astro", category: "framework" },
  { indicator: "vite", framework: "Vite", category: "bundler" },
  { indicator: "webpack", framework: "Webpack", category: "bundler" },
  { indicator: "esbuild", framework: "esbuild", category: "bundler" },
  { indicator: "electron", framework: "Electron", category: "framework" },
  { indicator: "hono", framework: "Hono", category: "framework" },
  { indicator: "express", framework: "Express", category: "framework" },
  { indicator: "effect", framework: "Effect-TS", category: "framework" },
  { indicator: "drizzle", framework: "Drizzle ORM", category: "framework" },
  { indicator: "zod", framework: "Zod", category: "framework" },
  { indicator: "sst", framework: "SST", category: "framework" },
  { indicator: "tailwindcss", framework: "Tailwind CSS", category: "framework" },
  { indicator: "opentui", framework: "OpenTUI", category: "framework" },
  { indicator: "kobalte", framework: "Kobalte", category: "framework" },
  { indicator: "turbo", framework: "Turborepo", category: "build" },

  // Testing
  { indicator: "bun:test", framework: "Bun Test", category: "test" },
  { indicator: "vitest", framework: "Vitest", category: "test" },
  { indicator: "jest", framework: "Jest", category: "test" },
  { indicator: "playwright", framework: "Playwright", category: "test" },
  { indicator: "fast-check", framework: "fast-check", category: "test" },

  // Linters
  { indicator: "oxlint", framework: "oxlint", category: "lint" },
  { indicator: "eslint", framework: "ESLint", category: "lint" },
  { indicator: "prettier", framework: "Prettier", category: "lint" },
  { indicator: "ast-grep", framework: "ast-grep", category: "lint" },

  // Runtimes
  { indicator: "bun", framework: "Bun", category: "runtime" },
  { indicator: "node", framework: "Node.js", category: "runtime" },
];

// ============================================================================
// Dependency Categorization
// ============================================================================

const DEPENDENCY_CATEGORIES: Record<string, DependencyInfo["category"]> = {
  // Core
  "effect": "core",
  "zod": "core",
  "remeda": "core",
  "drizzle-orm": "database",
  "@effect/sql-sqlite-bun": "database",
  "@effect/sql-sqlite-node": "database",
  "@effect/opentelemetry": "core",
  "@effect/platform-node": "core",

  // UI
  "solid-js": "ui",
  "@solidjs/router": "ui",
  "@solidjs/start": "ui",
  "@solidjs/meta": "ui",
  "@kobalte/core": "ui",
  "@corvu/drawer": "ui",
  "@opentui/core": "ui",
  "@opentui/solid": "ui",
  "tailwindcss": "ui",
  "solid-sonner": "ui",
  "dompurify": "ui",

  // AI
  "@ai-sdk/openai-compatible": "ai",
  "@ai-sdk/mistral": "ai",
  "@ai-sdk/google": "ai",

  // Network
  "hono": "network",
  "express": "network",

  // Testing
  "@playwright/test": "testing",
  "fast-check": "testing",
  "vitest": "testing",

  // Build
  "vite": "build",
  "turbo": "build",
  "esbuild": "build",
  "drizzle-kit": "build",
  "sst": "build",
  "typescript": "build",

  // Dev
  "oxlint": "dev",
  "prettier": "dev",
  "husky": "dev",
  "@ast-grep/cli": "dev",

  // Runtime
  "bun": "runtime",
  "node": "runtime",
};

function categorizeDependency(name: string): DependencyInfo["category"] {
  if (DEPENDENCY_CATEGORIES[name]) return DEPENDENCY_CATEGORIES[name];
  if (name.startsWith("@opencode/")) return "core";
  if (name.startsWith("@effect/")) return "core";
  if (name.startsWith("@ai-sdk/")) return "ai";
  if (name.startsWith("@solid-")) return "ui";
  if (name.startsWith("@opentui/")) return "ui";
  if (name.includes("test") || name.includes("playwright") || name.includes("fast-check")) return "testing";
  if (name.includes("lint") || name.includes("prettier") || name.includes("format")) return "dev";
  if (name.includes("vite") || name.includes("webpack") || name.includes("esbuild")) return "build";
  if (name.startsWith("@types/")) return "dev";
  return "utility";
}

// ============================================================================
// Architecture Pattern Detection
// ============================================================================

function detectArchitecture(
  files: string[],
  dependencies: Record<string, string>,
  rootPath: string
): CodebasePatterns {
  const patterns: CodebasePatterns = {
    architecturePattern: "unknown",
    stateManagement: [],
    apiPatterns: [],
    errorHandlingPattern: [],
    configurationPattern: "mixed",
    eventPatterns: [],
    databasePatterns: [],
    authPatterns: [],
  };

  const hasEffect = Object.keys(dependencies).some((d) => d.startsWith("effect") || d.startsWith("@effect/"));
  const hasSolid = "solid-js" in dependencies;
  const hasHono = "hono" in dependencies;
  const hasDrizzle = Object.keys(dependencies).some((d) => d.includes("drizzle"));

  // Architecture
  if (hasEffect && !hasSolid) {
    patterns.architecturePattern = "effect-ts";
    patterns.errorHandlingPattern.push("Effect-TS Result/Error channel");
  } else if (hasSolid) {
    patterns.architecturePattern = "reactive";
    patterns.stateManagement.push("SolidJS Signals");
  } else {
    patterns.architecturePattern = "mixed";
  }

  // State management
  if (hasEffect) patterns.stateManagement.push("Effect-TS Ref/Context");
  if (hasSolid) patterns.stateManagement.push("SolidJS Reactive Primitives");

  // API patterns
  if (hasHono) patterns.apiPatterns.push("Hono HTTP handlers");
  if (dependencies["@opencode/protocol"]) patterns.apiPatterns.push("RPC Protocol");

  // Configuration
  if (dependencies["zod"]) patterns.configurationPattern = "config-file";

  // Events
  if (files.some((f) => f.includes("bus") || f.includes("event"))) {
    patterns.eventPatterns.push("Event bus / pub-sub");
  }

  // Database
  if (hasDrizzle) patterns.databasePatterns.push("Drizzle ORM with SQLite");

  return patterns;
}

// ============================================================================
// Export Extraction
// ============================================================================

async function extractExports(srcDir: string, baseDir: string): Promise<ExportInfo[]> {
  const exports: ExportInfo[] = [];
  const TS_PATTERNS = [/\.ts$/, /\.tsx$/];

  try {
    const files = await findFiles(srcDir, TS_PATTERNS, 3);
    for (const file of files.slice(0, 50)) { // Limit to avoid excessive processing
      try {
        const content = await readFile(file, "utf-8");
        const relativePath = relative(baseDir, file);

        // Extract named exports
        const namedExportRegex = /export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
        let match;
        while ((match = namedExportRegex.exec(content)) !== null) {
          const name = match[1];
          let kind: ExportInfo["kind"] = "variable";
          if (match[0].includes("function")) kind = "function";
          else if (match[0].includes("class")) kind = "class";
          else if (match[0].includes("interface")) kind = "interface";
          else if (match[0].includes("type")) kind = "type";
          else if (match[0].includes("enum")) kind = "enum";

          exports.push({
            name,
            kind,
            filePath: relativePath,
            isDefault: false,
            hasJSDoc: content.includes(`/**`) && content.indexOf("/**") < content.indexOf(match[0]),
          });
        }

        // Extract default exports
        const defaultExportRegex = /export\s+default\s+(?:function|class)\s+(\w+)/g;
        while ((match = defaultExportRegex.exec(content)) !== null) {
          exports.push({
            name: match[1],
            kind: content.includes("class") ? "class" : "function",
            filePath: relativePath,
            isDefault: true,
            hasJSDoc: false,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory may not exist
  }

  return exports.slice(0, 200); // Cap exports
}

// ============================================================================
// Test Coverage Estimation
// ============================================================================

function estimateTestCoverage(files: string[], srcFiles: string[]): TestCoverageInfo {
  const testFiles = files.filter(isTestFile);
  const hasTests = testFiles.length > 0;

  let estimatedCoverage: TestCoverageInfo["estimatedCoverage"] = "none";
  if (hasTests) {
    const ratio = testFiles.length / Math.max(srcFiles.length, 1);
    if (ratio > 0.5) estimatedCoverage = "high";
    else if (ratio > 0.2) estimatedCoverage = "medium";
    else estimatedCoverage = "low";
  }

  return {
    hasTests,
    testFiles: testFiles.map((f) => basename(f)).slice(0, 20),
    testFramework: detectTestFramework(files),
    estimatedCoverage,
  };
}

function detectTestFramework(files: string[]): string {
  for (const file of files) {
    if (file.includes("bun:test") || file.endsWith(".bun.ts")) return "Bun Test";
  }
  return "Bun Test"; // Default for this project
}

// ============================================================================
// Main Indexer Class
// ============================================================================

export class CodebaseIndexer {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Discover all codebases in the monorepo.
   * Looks for package.json files in packages/, services/, and sdks/ directories.
   */
  async discoverCodebases(): Promise<string[]> {
    const codebases: string[] = [];
    const searchDirs = ["packages", "services", "sdks", "infra", "specs"];

    for (const dir of searchDirs) {
      const fullDir = join(this.rootPath, dir);
      try {
        const entries = await readdir(fullDir);
        for (const entry of entries) {
          const entryPath = join(fullDir, entry);
          const entryStat = await stat(entryPath).catch(() => null);
          if (!entryStat || !entryStat.isDirectory()) continue;

          // Check if this directory has a package.json (direct package)
          const pkgPath = join(entryPath, "package.json");
          const pkgStat = await stat(pkgPath).catch(() => null);
          if (pkgStat) {
            codebases.push(entryPath);
          }

          // Check for nested packages (e.g., packages/console/app, packages/plugins/*)
          try {
            const subEntries = await readdir(entryPath);
            for (const sub of subEntries) {
              const subPath = join(entryPath, sub);
              const subStat = await stat(subPath).catch(() => null);
              if (!subStat || !subStat.isDirectory()) continue;
              const subPkgPath = join(subPath, "package.json");
              const subPkgStat = await stat(subPkgPath).catch(() => null);
              if (subPkgStat) {
                codebases.push(subPath);
              }
            }
          } catch {
            // Can't read subdirectory
          }
        }
      } catch {
        // Directory doesn't exist
      }
    }

    // Also check root
    codebases.push(this.rootPath);

    return [...new Set(codebases)];
  }

  /**
   * Index a single codebase completely.
   */
  async indexCodebase(codebasePath: string): Promise<CodebaseIndex> {
    log.info(`Indexing codebase at ${relative(this.rootPath, codebasePath)}`);

    const pkg = await readJson<Record<string, unknown>>(join(codebasePath, "package.json"));
    if (!pkg) {
      throw new Error(`No package.json found at ${codebasePath}`);
    }

    const name = (pkg.name as string) || basename(codebasePath);
    const relativePath = relative(this.rootPath, codebasePath);
    const id = generateId(relativePath || "root");

    // Gather all files
    const allFiles = await findFiles(codebasePath, [/\.(ts|tsx|js|jsx|json|md|css|html|yaml|yml)$/], 6);
    const tsFiles = allFiles.filter((f) => /\.ts$/.test(f));
    const tsxFiles = allFiles.filter((f) => /\.tsx$/.test(f));
    const testFiles = allFiles.filter(isTestFile);
    const srcFiles = allFiles.filter((f) => !isTestFile)
      .filter((f) => /\.(ts|tsx)$/.test(f));

    // Compute metrics
    const lineCounts = await Promise.all(srcFiles.slice(0, 200).map(countLines));
    const totalLines = lineCounts.reduce((a, b) => a + b, 0);
    const maxFileLines = Math.max(...lineCounts, 0);

    const metrics: CodebaseMetrics = {
      fileCount: allFiles.length,
      lineCount: totalLines,
      tsFileCount: tsFiles.length,
      tsxFileCount: tsxFiles.length,
      testFileCount: testFiles.length,
      configFiles: allFiles
        .filter((f) => /\.(json|yaml|yml|toml)$/.test(f))
        .map((f) => relative(codebasePath, f))
        .slice(0, 20),
      entryPoints: extractEntryPoints(pkg),
      exportedSymbols: 0, // Updated below
      averageFileLines: srcFiles.length > 0 ? Math.round(totalLines / srcFiles.length) : 0,
      maxFileLines,
      directoryDepth: getDirectoryDepth(relativePath),
    };

    // Analyze dependencies
    const deps = (pkg.dependencies || {}) as Record<string, string>;
    const devDeps = (pkg.devDependencies || {}) as Record<string, string>;
    const allDeps = { ...deps, ...devDeps };

    const dependencies: DependencyInfo[] = Object.entries(allDeps).map(([name, version]) => ({
      name,
      version,
      isDev: name in devDeps,
      isWorkspace: typeof version === "string" && version.startsWith("workspace:"),
      category: categorizeDependency(name),
    }));

    // Detect tech stack
    const techStack = this.detectTechStack(allDeps, allFiles);

    // Detect patterns
    const patterns = detectArchitecture(allFiles, allDeps, this.rootPath);

    // Extract exports
    const srcDir = join(codebasePath, "src");
    const exports = await extractExports(srcDir, codebasePath);
    metrics.exportedSymbols = exports.length;

    // Test coverage
    const testCoverage = estimateTestCoverage(allFiles, srcFiles);

    // Determine codebase type
    const type = this.classifyCodebase(pkg, techStack, patterns, relativePath);

    return {
      id,
      name,
      path: codebasePath,
      relativePath: relativePath || "root",
      description: (pkg.description as string) || `Codebase: ${name}`,
      type,
      version: (pkg.version as string) || "0.0.0",
      isPrivate: (pkg.private as boolean) || false,
      techStack,
      dependencies,
      metrics,
      patterns,
      entryPoints: metrics.entryPoints,
      exports,
      testCoverage,
      hasCI: allFiles.some((f) => f.includes(".github/workflows")),
      hasLinting: "oxlint" in allDeps || "eslint" in allDeps || "prettier" in allDeps,
      hasTypeChecking: "typescript" in allDeps,
      indexedAt: new Date(),
    };
  }

  /**
   * Detect the technology stack from dependencies and files.
   */
  private detectTechStack(
    dependencies: Record<string, string>,
    files: string[]
  ): TechStack {
    const detected: Record<string, string[]> = {
      framework: [],
      build: [],
      test: [],
      lint: [],
      runtime: [],
      bundler: [],
    };

    for (const depName of Object.keys(dependencies)) {
      for (const rule of DETECTION_RULES) {
        if (depName === rule.indicator || depName.includes(rule.indicator)) {
          if (!detected[rule.category].includes(rule.framework)) {
            detected[rule.category].push(rule.framework);
          }
        }
      }
    }

    // Detect from file patterns
    if (files.some((f) => f.endsWith(".tsx"))) {
      if (!detected.framework.includes("JSX/TSX")) detected.framework.push("JSX/TSX");
    }

    const language = "TypeScript";
    const runtimes = detected.runtime.length > 0 ? detected.runtime : ["Node.js"];

    return {
      language,
      runtime: runtimes,
      framework: detected.framework,
      buildTools: [...new Set([...detected.build, ...detected.bundler])],
      testingFrameworks: detected.test,
      linters: detected.lint,
      bundlers: detected.bundler,
    };
  }

  /**
   * Classify the codebase type based on analysis.
   */
  private classifyCodebase(
    pkg: Record<string, unknown>,
    techStack: TechStack,
    patterns: CodebasePatterns,
    relativePath: string
  ): CodebaseType {
    if (!relativePath || relativePath === ".") return "monorepo-root";
    if (relativePath.startsWith("services/")) return "service";
    if (relativePath.startsWith("sdks/")) return "sdk";

    // Check for UI component packages
    if (
      techStack.framework.some((f) => ["SolidJS", "React", "Kobalte", "OpenTUI"].includes(f)) &&
      relativePath.includes("ui")
    ) {
      return "ui-components";
    }

    // Check for CLI
    if (pkg.bin || relativePath.includes("cli")) return "cli";

    // Check for protocol
    if (relativePath.includes("protocol")) return "protocol";

    // Check for web/documentation
    if (techStack.framework.includes("Astro") || relativePath.includes("web") || relativePath.includes("site")) {
      return "documentation";
    }

    // Check for desktop app
    if (techStack.framework.includes("Electron")) return "application";

    // Check for infrastructure
    if (relativePath.includes("infra") || relativePath.includes("script")) return "infrastructure";

    // Default classification
    if (techStack.framework.includes("Hono")) return "service";
    if (pkg.private) return "application";

    return "library";
  }

  /**
   * Index all discovered codebases.
   */
  async indexAll(): Promise<Map<string, CodebaseIndex>> {
    const codebases = await this.discoverCodebases();
    const indices = new Map<string, CodebaseIndex>();

    log.info(`Discovered ${codebases.length} codebases to index`);

    for (const cbPath of codebases) {
      try {
        const index = await this.indexCodebase(cbPath);
        indices.set(index.id, index);
        log.info(`  Indexed: ${index.name} (${index.type}, ${index.metrics.fileCount} files)`);
      } catch (err) {
        log.warn(`  Failed to index ${cbPath}: ${err}`);
      }
    }

    log.info(`Successfully indexed ${indices.size} codebases`);
    return indices;
  }
}
