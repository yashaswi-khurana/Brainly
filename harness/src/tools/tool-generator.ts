/**
 * Codebase Harness - Tool Generator
 *
 * Generates codebase-specific tools based on the codebase index. Each codebase
 * gets a unique set of tools tailored to its type, tech stack, patterns, and
 * structure.
 *
 * Tool categories include:
 * - Navigation: Explore codebase structure
 * - Analysis: Understand code patterns and metrics
 * - Search: Find specific code patterns
 * - Transformation: Modify code safely
 * - Testing: Run and analyze tests
 * - Build: Build and bundle the codebase
 * - Documentation: Generate docs from code
 * - Validation: Verify correctness
 * - Debugging: Inspect runtime state
 */

import { readFile, readdir } from "fs/promises";
import { join, relative, basename } from "path";
import type {
  ToolDefinition,
  ToolCategory,
  ToolParameter,
  CodebaseIndex,
  Environment,
  HarnessEvent,
} from "../types/index";
import { generateId, Logger } from "../utils/index";

const log = new Logger("ToolGenerator");

// ============================================================================
// Tool Templates by Codebase Type
// ============================================================================

interface ToolTemplate {
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  implementation: string;
  isReadOnly: boolean;
  requiresNetwork: boolean;
  tags: string[];
  applicableTypes: string[];
  applicableFrameworks?: string[];
  applicablePatterns?: string[];
}

const TOOL_TEMPLATES: ToolTemplate[] = [
  // ====== UNIVERSAL TOOLS (apply to all codebases) ======
  {
    name: "file-explorer",
    description: "Navigate and list files in the codebase directory tree with filtering by extension, pattern, and depth",
    category: "navigation",
    parameters: [
      { name: "path", description: "Relative path within codebase to explore", type: "string", required: false, default: "." },
      { name: "pattern", description: "Glob pattern to filter files", type: "string", required: false },
      { name: "maxDepth", description: "Maximum directory depth to recurse", type: "number", required: false, default: 5 },
      { name: "includeDirs", description: "Include directories in results", type: "boolean", required: false, default: true },
    ],
    implementation: `
async function fileExplorer(params, env) {
  const path = require('path');
  const fs = require('fs/promises');
  const root = env.config.workDir || env.config.fileAccessPolicy.readPaths[0];
  const target = path.resolve(root, params.path || '.');
  const maxDepth = params.maxDepth || 5;
  const results = [];
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (['node_modules', '.git', 'dist', 'build', '.harness'].includes(entry)) continue;
      const full = path.join(dir, entry);
      const rel = path.relative(root, full);
      if (entry.isDirectory() && params.includeDirs) {
        results.push({ path: rel, type: 'directory' });
        await walk(full, depth + 1);
      } else if (entry.isFile()) {
        if (params.pattern && !require('minimatch')(entry, params.pattern)) continue;
        results.push({ path: rel, type: 'file' });
      }
    }
  }
  await walk(target, 0);
  return results;
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["navigation", "filesystem", "universal"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components", "protocol", "documentation", "infrastructure", "monorepo-root"],
  },

  {
    name: "codebase-summary",
    description: "Generate a comprehensive summary of the codebase including file counts, structure overview, key modules, and technology summary",
    category: "analysis",
    parameters: [
      { name: "includeMetrics", description: "Include detailed metrics", type: "boolean", required: false, default: true },
      { name: "format", description: "Output format: text, json, or markdown", type: "enum", required: false, default: "markdown", enumValues: ["text", "json", "markdown"] },
    ],
    implementation: `
async function codebaseSummary(params, env, index) {
  const summary = {
    name: index.name,
    type: index.type,
    version: index.version,
    description: index.description,
    techStack: {
      language: index.techStack.language,
      runtime: index.techStack.runtime.join(', '),
      frameworks: index.techStack.framework.join(', '),
      buildTools: index.techStack.buildTools.join(', '),
      testing: index.techStack.testingFrameworks.join(', '),
    },
    metrics: params.includeMetrics ? {
      totalFiles: index.metrics.fileCount,
      tsFiles: index.metrics.tsFileCount,
      tsxFiles: index.metrics.tsxFileCount,
      testFiles: index.metrics.testFileCount,
      totalLines: index.metrics.lineCount,
      avgLinesPerFile: index.metrics.averageFileLines,
      maxFileLines: index.metrics.maxFileLines,
      exportedSymbols: index.metrics.exportedSymbols,
    } : undefined,
    architecture: index.patterns.architecturePattern,
    entryPoints: index.entryPoints,
    testCoverage: index.testCoverage.estimatedCoverage,
    keyDependencies: index.dependencies
      .filter(d => !d.isDev && !d.isWorkspace)
      .slice(0, 15)
      .map(d => d.name + '@' + d.version),
  };
  return summary;
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["analysis", "summary", "universal"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components", "protocol", "documentation", "infrastructure", "monorepo-root"],
  },

  {
    name: "symbol-finder",
    description: "Find and locate exported symbols (functions, classes, interfaces, types) in the codebase with search and filtering",
    category: "search",
    parameters: [
      { name: "name", description: "Symbol name or pattern to search for", type: "string", required: true },
      { name: "kind", description: "Symbol kind to filter by", type: "enum", required: false, enumValues: ["function", "class", "interface", "type", "constant", "enum"] },
      { name: "filePath", description: "Limit search to a specific file path", type: "string", required: false },
    ],
    implementation: `
async function symbolFinder(params, env, index) {
  const results = [];
  for (const exp of index.exports) {
    if (params.name && !exp.name.toLowerCase().includes(params.name.toLowerCase())) continue;
    if (params.kind && exp.kind !== params.kind) continue;
    if (params.filePath && !exp.filePath.includes(params.filePath)) continue;
    results.push({
      name: exp.name,
      kind: exp.kind,
      file: exp.filePath,
      isDefault: exp.isDefault,
      documented: exp.hasJSDoc,
    });
  }
  return { total: results.length, symbols: results };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["search", "symbols", "exports", "universal"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components", "protocol"],
  },

  {
    name: "dependency-analyzer",
    description: "Analyze dependencies with categorization, version info, workspace links, and dependency graph",
    category: "analysis",
    parameters: [
      { name: "category", description: "Filter by dependency category", type: "enum", required: false, enumValues: ["core", "ui", "testing", "build", "dev", "runtime", "ai", "database", "network", "utility"] },
      { name: "includeDev", description: "Include dev dependencies", type: "boolean", required: false, default: true },
      { name: "workspaceOnly", description: "Show only workspace dependencies", type: "boolean", required: false, default: false },
    ],
    implementation: `
async function dependencyAnalyzer(params, env, index) {
  let deps = index.dependencies;
  if (params.category) deps = deps.filter(d => d.category === params.category);
  if (!params.includeDev) deps = deps.filter(d => !d.isDev);
  if (params.workspaceOnly) deps = deps.filter(d => d.isWorkspace);

  const categorized = {};
  for (const d of deps) {
    if (!categorized[d.category]) categorized[d.category] = [];
    categorized[d.category].push({ name: d.name, version: d.version, isDev: d.isDev, isWorkspace: d.isWorkspace });
  }
  return {
    total: deps.length,
    byCategory: categorized,
    workspaceLinks: deps.filter(d => d.isWorkspace).map(d => d.name),
  };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["analysis", "dependencies", "universal"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components", "protocol", "documentation", "infrastructure", "monorepo-root"],
  },

  // ====== APPLICATION / SERVICE TOOLS ======
  {
    name: "route-inspector",
    description: "Discover and list all HTTP routes/endpoints defined in the application, with method, path, and handler info",
    category: "navigation",
    parameters: [
      { name: "method", description: "Filter by HTTP method", type: "enum", required: false, enumValues: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
      { name: "pathPrefix", description: "Filter routes by path prefix", type: "string", required: false },
    ],
    implementation: `
async function routeInspector(params, env, index) {
  const fs = require('fs/promises');
  const path = require('path');
  const srcDir = path.join(index.path, 'src');
  const routes = [];

  async function scanFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const routePatterns = [
      /app\\.(get|post|put|delete|patch)\\s*\\(\\s*['"\\\`]([^'"\\\`]+)['"\\\`]/gi,
      /c\\.(get|post|put|delete|patch)\\s*\\(\\s*['"\\\`]([^'"\\\`]+)['"\\\`]/gi,
      /router\\.(get|post|put|delete|patch)\\s*\\(\\s*['"\\\`]([^'"\\\`]+)['"\\\`]/gi,
    ];
    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: path.relative(index.path, filePath),
        });
      }
    }
  }

  try {
    const files = await findFiles(srcDir, [/\\.(ts|tsx|js)$/], 4);
    for (const f of files) await scanFile(f);
  } catch {}

  let filtered = routes;
  if (params.method) filtered = filtered.filter(r => r.method === params.method);
  if (params.pathPrefix) filtered = filtered.filter(r => r.path.startsWith(params.pathPrefix));
  return { total: filtered.length, routes: filtered };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["navigation", "routes", "http", "api"],
    applicableTypes: ["application", "service"],
    applicableFrameworks: ["Hono", "Express"],
  },

  {
    name: "dev-server-launcher",
    description: "Start the development server with hot reload and proper environment configuration",
    category: "build",
    parameters: [
      { name: "port", description: "Port to run the dev server on", type: "number", required: false, default: 3000 },
      { name: "host", description: "Host to bind to", type: "string", required: false, default: "0.0.0.0" },
    ],
    implementation: `
async function devServerLauncher(params, env, index) {
  const { spawn } = require('child_process');
  const port = params.port || 3000;
  const host = params.host || '0.0.0.0';
  const envVars = { ...process.env, ...env.config.envVars, PORT: String(port), HOST: host };
  const devCmd = detectDevCommand(index);
  const child = spawn(devCmd.cmd, devCmd.args, { env: envVars, cwd: index.path });
  return {
    command: devCmd.cmd + ' ' + devCmd.args.join(' '),
    port, host,
    pid: child.pid,
    message: 'Dev server starting...',
  };
}`,
    isReadOnly: false,
    requiresNetwork: true,
    tags: ["build", "dev-server", "hot-reload"],
    applicableTypes: ["application", "service"],
  },

  {
    name: "build-runner",
    description: "Execute the build pipeline for the codebase with type checking, linting, and bundling",
    category: "build",
    parameters: [
      { name: "mode", description: "Build mode: development or production", type: "enum", required: false, default: "production", enumValues: ["development", "production"] },
      { name: "skipLint", description: "Skip linting step", type: "boolean", required: false, default: false },
      { name: "skipTypes", description: "Skip type checking", type: "boolean", required: false, default: false },
    ],
    implementation: `
async function buildRunner(params, env, index) {
  const { execSync } = require('child_process');
  const steps = [];
  const results = { success: true, steps: [] };

  if (!params.skipTypes && index.hasTypeChecking) {
    steps.push({ name: 'typecheck', cmd: 'bun turbo typecheck --concurrency=3' });
  }
  if (!params.skipLint && index.hasLinting) {
    steps.push({ name: 'lint', cmd: 'bun oxlint' });
  }
  steps.push({ name: 'build', cmd: 'bun turbo build' });

  for (const step of steps) {
    try {
      execSync(step.cmd, { cwd: index.path, env: { ...process.env, NODE_ENV: params.mode || 'production' } });
      results.steps.push({ ...step, status: 'passed' });
    } catch (e) {
      results.steps.push({ ...step, status: 'failed', error: e.message });
      results.success = false;
      break;
    }
  }
  return results;
}`,
    isReadOnly: false,
    requiresNetwork: false,
    tags: ["build", "pipeline", "ci"],
    applicableTypes: ["application", "service", "library", "sdk", "ui-components"],
  },

  // ====== LIBRARY / SDK TOOLS ======
  {
    name: "public-api-explorer",
    description: "Explore the public API surface of a library/SDK — all exported symbols, their signatures, and documentation status",
    category: "navigation",
    parameters: [
      { name: "entryPoint", description: "Specific entry point to explore", type: "string", required: false },
      { name: "kind", description: "Filter by export kind", type: "enum", required: false, enumValues: ["function", "class", "interface", "type", "constant"] },
      { name: "documented", description: "Filter by documentation status", type: "boolean", required: false },
    ],
    implementation: `
async function publicApiExplorer(params, env, index) {
  let exports = [...index.exports];
  if (params.kind) exports = exports.filter(e => e.kind === params.kind);
  if (params.documented !== undefined) exports = exports.filter(e => e.hasJSDoc === params.documented);
  if (params.entryPoint) exports = exports.filter(e => e.filePath.includes(params.entryPoint));

  const apiSurface = {
    totalExports: exports.length,
    byKind: {},
    documented: exports.filter(e => e.hasJSDoc).length,
    undocumented: exports.filter(e => !e.hasJSDoc).length,
    exports: exports.map(e => ({
      name: e.name,
      kind: e.kind,
      file: e.filePath,
      documented: e.hasJSDoc,
      default: e.isDefault,
    })),
  };

  for (const e of exports) {
    apiSurface.byKind[e.kind] = (apiSurface.byKind[e.kind] || 0) + 1;
  }
  return apiSurface;
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["navigation", "api-surface", "exports"],
    applicableTypes: ["library", "sdk"],
  },

  {
    name: "breaking-change-detector",
    description: "Analyze exported API to detect potentially breaking changes between versions",
    category: "validation",
    parameters: [
      { name: "previousExports", description: "Previous version's export list", type: "array", required: true },
      { name: "strict", description: "Strict mode: flag any change as breaking", type: "boolean", required: false, default: false },
    ],
    implementation: `
async function breakingChangeDetector(params, env, index) {
  const currentExports = new Map(index.exports.map(e => [e.name, e]));
  const previousExports = new Map(params.previousExports.map(e => [e.name, e]));
  const changes = {
    removed: [],
    added: [],
    modified: [],
    breakingChanges: [],
  };

  for (const [name] of previousExports) {
    if (!currentExports.has(name)) {
      changes.removed.push(name);
      changes.breakingChanges.push({ type: 'removed', name, message: 'Export removed: ' + name });
    }
  }
  for (const [name] of currentExports) {
    if (!previousExports.has(name)) {
      changes.added.push(name);
    }
  }

  return {
    ...changes,
    summary: {
      removed: changes.removed.length,
      added: changes.added.length,
      breakingCount: changes.breakingChanges.length,
      isBreaking: changes.breakingChanges.length > 0,
    },
  };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["validation", "api-compat", "semver"],
    applicableTypes: ["library", "sdk"],
  },

  {
    name: "bundle-analyzer",
    description: "Analyze the bundle output of the codebase — entry points, chunk sizes, and dependency weights",
    category: "analysis",
    parameters: [
      { name: "entryPoint", description: "Specific entry point to analyze", type: "string", required: false },
    ],
    implementation: `
async function bundleAnalyzer(params, env, index) {
  const analysis = {
    entryPoints: index.entryPoints,
    totalFiles: index.metrics.fileCount,
    totalLines: index.metrics.lineCount,
    estimatedBundleSize: {
      raw: index.metrics.lineCount * 40, // rough estimate: ~40 bytes per line minified
      gzipped: Math.round(index.metrics.lineCount * 40 * 0.3), // ~30% gzip ratio
    },
    dependencyCount: index.dependencies.filter(d => !d.isDev).length,
    devDependencyCount: index.dependencies.filter(d => d.isDev).length,
    largestFiles: index.exports
      .sort((a, b) => (b.parameterCount || 0) - (a.parameterCount || 0))
      .slice(0, 10)
      .map(e => e.filePath),
  };
  return analysis;
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["analysis", "bundle", "optimization"],
    applicableTypes: ["library", "sdk", "application", "ui-components"],
  },

  // ====== CLI TOOLS ======
  {
    name: "command-explorer",
    description: "Discover and list all CLI commands and subcommands defined in the codebase",
    category: "navigation",
    parameters: [
      { name: "includeFlags", description: "Include flag/option details", type: "boolean", required: false, default: true },
    ],
    implementation: `
async function commandExplorer(params, env, index) {
  const fs = require('fs/promises');
  const path = require('path');
  const commands = [];

  async function scanCommands(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.endsWith('.ts') || entry.endsWith('.js')) {
          const full = path.join(dir, entry);
          const content = await fs.readFile(full, 'utf-8');
          const cmdMatch = content.match(/command\\s*[:=]\\s*['"\\\`](\\S+)['"\\\`]/);
          const descMatch = content.match(/description\\s*[:=]\\s*['"\\\`]([^'"\\\`]+)['"\\\`]/);
          if (cmdMatch) {
            commands.push({
              name: cmdMatch[1],
              description: descMatch ? descMatch[1] : '',
              file: path.relative(index.path, full),
            });
          }
        } else if (entry.isDirectory()) {
          await scanCommands(path.join(dir, entry));
        }
      }
    } catch {}
  }

  await scanCommands(path.join(index.path, 'src', 'commands'));
  await scanCommands(path.join(index.path, 'src', 'run'));
  return { total: commands.length, commands };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["navigation", "commands", "cli"],
    applicableTypes: ["cli"],
  },

  // ====== UI COMPONENT TOOLS ======
  {
    name: "component-registry",
    description: "List all UI components with their props, variants, and documentation status",
    category: "navigation",
    parameters: [
      { name: "category", description: "Filter by component category (forms, layout, feedback, etc.)", type: "string", required: false },
    ],
    implementation: `
async function componentRegistry(params, env, index) {
  const fs = require('fs/promises');
  const path = require('path');
  const components = [];

  async function scan(dir, category) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry);
        if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
          const content = await fs.readFile(full, 'utf-8');
          const componentMatch = content.match(/(?:function|const)\\s+([A-Z]\\w+)/);
          const propsMatch = content.match(/interface\\s+(\\w+Props)/);
          if (componentMatch) {
            components.push({
              name: componentMatch[1],
              props: propsMatch ? propsMatch[1] : null,
              file: path.relative(index.path, full),
              category: category || 'uncategorized',
              documented: content.includes('/**') || content.includes('@param'),
            });
          }
        } else if (entry.isDirectory() && !entry.startsWith('.')) {
          await scan(full, entry);
        }
      }
    } catch {}
  }

  await scan(path.join(index.path, 'src', 'components'), null);
  let filtered = components;
  if (params.category) filtered = filtered.filter(c => c.category.includes(params.category));
  return { total: filtered.length, components: filtered };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["navigation", "components", "ui"],
    applicableTypes: ["ui-components"],
  },

  // ====== PROTOCOL TOOLS ======
  {
    name: "schema-validator",
    description: "Validate API schemas and protocol definitions for consistency and completeness",
    category: "validation",
    parameters: [
      { name: "strict", description: "Enable strict validation mode", type: "boolean", required: false, default: false },
    ],
    implementation: `
async function schemaValidator(params, env, index) {
  const fs = require('fs/promises');
  const path = require('path');
  const results = { valid: true, errors: [], warnings: [] };

  // Check for required protocol files
  const apiFile = path.join(index.path, 'src', 'api.ts');
  try {
    const content = await fs.readFile(apiFile, 'utf-8');
    if (!content.includes('export')) {
      results.warnings.push('API file has no exports');
    }
  } catch {
    results.errors.push('Missing api.ts in src/');
    results.valid = false;
  }

  // Check client file
  const clientFile = path.join(index.path, 'src', 'client.ts');
  try {
    const content = await fs.readFile(clientFile, 'utf-8');
    if (!content.includes('export')) {
      results.warnings.push('Client file has no exports');
    }
  } catch {
    results.warnings.push('No client.ts found');
  }

  return results;
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["validation", "schema", "protocol"],
    applicableTypes: ["protocol"],
  },

  // ====== DOCUMENTATION TOOLS ======
  {
    name: "content-analyzer",
    description: "Analyze documentation content — pages, sections, links, and coverage gaps",
    category: "analysis",
    parameters: [
      { name: "section", description: "Specific section to analyze", type: "string", required: false },
    ],
    implementation: `
async function contentAnalyzer(params, env, index) {
  const fs = require('fs/promises');
  const path = require('path');
  const pages = [];

  async function scanPages(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry);
        if (entry.endsWith('.md') || entry.endsWith('.mdx')) {
          const content = await fs.readFile(full, 'utf-8');
          const titleMatch = content.match(/^#\\s+(.+)$/m);
          pages.push({
            title: titleMatch ? titleMatch[1] : entry.replace(/\\.(md|mdx)$/, ''),
            file: path.relative(index.path, full),
            wordCount: content.split(/\\s+/).length,
            hasCodeBlocks: content.includes('\\'\\'\\''),
          });
        } else if (entry.isDirectory() && !entry.startsWith('.')) {
          await scanPages(full);
        }
      }
    } catch {}
  }

  await scanPages(path.join(index.path, 'src'));
  return { total: pages.length, pages, totalWords: pages.reduce((s, p) => s + p.wordCount, 0) };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["analysis", "content", "documentation"],
    applicableTypes: ["documentation"],
  },

  // ====== MONOREPO TOOLS ======
  {
    name: "workspace-graph",
    description: "Generate a dependency graph of all workspaces in the monorepo showing inter-package relationships",
    category: "analysis",
    parameters: [
      { name: "format", description: "Output format: json or mermaid", type: "enum", required: false, default: "json", enumValues: ["json", "mermaid"] },
      { name: "includeDev", description: "Include dev dependencies in graph", type: "boolean", required: false, default: false },
    ],
    implementation: `
async function workspaceGraph(params, env, allIndices) {
  const nodes = [];
  const edges = [];

  for (const [id, idx] of allIndices) {
    nodes.push({ id: idx.name, type: idx.type, path: idx.relativePath });
    for (const dep of idx.dependencies) {
      if (dep.isWorkspace) {
        edges.push({
          from: idx.name,
          to: dep.name,
          type: dep.isDev ? 'dev' : 'prod',
        });
      }
    }
  }

  if (params.format === 'mermaid') {
    let mermaid = 'graph TD\\\\n';
    for (const edge of edges) {
      mermaid += '  "' + edge.from + '" --> "' + edge.to + '"\\\\n';
    }
    return mermaid;
  }

  return { nodes, edges };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["analysis", "graph", "monorepo", "workspaces"],
    applicableTypes: ["monorepo-root"],
  },

  {
    name: "cross-package-search",
    description: "Search for symbols, patterns, or code across all packages in the monorepo",
    category: "search",
    parameters: [
      { name: "query", description: "Search query (symbol name, pattern, or text)", type: "string", required: true },
      { name: "packageFilter", description: "Filter to specific package types", type: "enum", required: false, enumValues: ["all", "library", "service", "application", "cli"] },
    ],
    implementation: `
async function crossPackageSearch(params, env, allIndices) {
  const results = [];
  for (const [id, idx] of allIndices) {
    if (params.packageFilter && params.packageFilter !== 'all' && idx.type !== params.packageFilter) continue;
    const matchingExports = idx.exports.filter(e =>
      e.name.toLowerCase().includes(params.query.toLowerCase())
    );
    if (matchingExports.length > 0) {
      results.push({
        package: idx.name,
        type: idx.type,
        matches: matchingExports.map(e => ({ name: e.name, kind: e.kind, file: e.filePath })),
      });
    }
  }
  return { query: params.query, packageMatches: results.length, totalMatches: results.reduce((s, r) => s + r.matches.length, 0), results };
}`,
    isReadOnly: true,
    requiresNetwork: false,
    tags: ["search", "cross-package", "monorepo"],
    applicableTypes: ["monorepo-root"],
  },

  // ====== TESTING TOOLS ======
  {
    name: "test-runner",
    description: "Run the test suite for the codebase with configurable options for filtering, coverage, and reporting",
    category: "testing",
    parameters: [
      { name: "filter", description: "Test name pattern to filter", type: "string", required: false },
      { name: "coverage", description: "Generate coverage report", type: "boolean", required: false, default: false },
      { name: "timeout", description: "Test timeout in milliseconds", type: "number", required: false, default: 30000 },
    ],
    implementation: `
async function testRunner(params, env, index) {
  const { execSync } = require('child_process');
  const args = ['test', '--timeout', String(params.timeout || 30000)];
  if (params.filter) args.push('--filter', params.filter);
  if (params.coverage) args.push('--coverage');

  try {
    const output = execSync('bun ' + args.join(' '), {
      cwd: index.path,
      encoding: 'utf-8',
      env: { ...process.env, ...env.config.envVars },
    });
    return { success: true, output };
  } catch (e) {
    return { success: false, output: e.stdout || '', error: e.stderr || e.message };
  }
}`,
    isReadOnly: false,
    requiresNetwork: false,
    tags: ["testing", "test-runner", "coverage"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components"],
  },

  // ====== LINT / TYPE TOOLS ======
  {
    name: "lint-runner",
    description: "Run linting checks on the codebase and parse results into structured format",
    category: "validation",
    parameters: [
      { name: "fix", description: "Auto-fix issues where possible", type: "boolean", required: false, default: false },
      { name: "severity", description: "Minimum severity to report", type: "enum", required: false, default: "warning", enumValues: ["error", "warning", "info"] },
    ],
    implementation: `
async function lintRunner(params, env, index) {
  const { execSync } = require('child_process');
  const cmd = params.fix ? 'bun oxlint --fix' : 'bun oxlint';
  try {
    const output = execSync(cmd, { cwd: index.path, encoding: 'utf-8' });
    return { success: true, issues: 0, output };
  } catch (e) {
    const output = (e.stdout || '') + (e.stderr || '');
    const issueCount = (output.match(/\\d+ problems?/i) || ['0'])[0];
    return { success: false, issues: issueCount, output };
  }
}`,
    isReadOnly: false,
    requiresNetwork: false,
    tags: ["validation", "lint", "quality"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components"],
  },

  {
    name: "type-checker",
    description: "Run TypeScript type checking and parse errors into structured format with file locations",
    category: "validation",
    parameters: [
      { name: "file", description: "Specific file to check", type: "string", required: false },
    ],
    implementation: `
async function typeChecker(params, env, index) {
  const { execSync } = require('child_process');
  try {
    const output = execSync('bun turbo typecheck', {
      cwd: index.path,
      encoding: 'utf-8',
      env: { ...process.env, ...env.config.envVars },
    });
    return { success: true, errors: [], output };
  } catch (e) {
    const output = (e.stdout || '') + (e.stderr || '');
    const errorLines = output.split('\\n').filter(l => l.includes('error TS'));
    const errors = errorLines.map(line => {
      const match = line.match(/(.+)\\((\\d+),(\\d+)\\):\\s+error\\s+(TS\\d+):\\s+(.+)/);
      if (match) return { file: match[1], line: +match[2], col: +match[3], code: match[4], message: match[5] };
      return { raw: line };
    });
    return { success: false, errors, errorCount: errors.length, output };
  }
}`,
    isReadOnly: false,
    requiresNetwork: false,
    tags: ["validation", "typescript", "type-check"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components"],
  },
];

// ============================================================================
// Tool Generator Class
// ============================================================================

export class ToolGenerator {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Generate all applicable tools for a codebase based on its index.
   */
  generateTools(index: CodebaseIndex, env: Environment): ToolDefinition[] {
    const tools: ToolDefinition[] = [];

    for (const template of TOOL_TEMPLATES) {
      // Check if this template applies to this codebase type
      if (!template.applicableTypes.includes(index.type)) continue;

      // Check framework applicability
      if (template.applicableFrameworks && template.applicableFrameworks.length > 0) {
        const hasFramework = template.applicableFrameworks.some((f) =>
          index.techStack.framework.includes(f)
        );
        if (!hasFramework) continue;
      }

      // Check pattern applicability
      if (template.applicablePatterns && template.applicablePatterns.length > 0) {
        const hasPattern = template.applicablePatterns.includes(index.patterns.architecturePattern);
        if (!hasPattern) continue;
      }

      const toolId = generateId(`${index.id}-${template.name}`);
      const tool: ToolDefinition = {
        id: toolId,
        name: template.name,
        description: this.customizeDescription(template, index),
        category: template.category,
        codebaseId: index.id,
        environmentId: env.config.id,
        parameters: template.parameters,
        returnType: "object",
        implementation: template.implementation,
        dependencies: template.tags,
        isReadOnly: template.isReadOnly,
        requiresNetwork: template.requiresNetwork,
        timeoutMs: env.config.resourceLimits.timeoutMs,
        tags: template.tags,
      };

      tools.push(tool);
    }

    log.info(`Generated ${tools.length} tools for '${index.name}' (${index.type})`);
    return tools;
  }

  /**
   * Generate tools for all codebases at once (needed for monorepo cross-package tools).
   */
  generateAllTools(
    indices: Map<string, CodebaseIndex>,
    environments: Map<string, Environment>
  ): Map<string, ToolDefinition[]> {
    const allTools = new Map<string, ToolDefinition[]>();

    for (const [id, index] of indices) {
      const env = environments.get(`env-${id}`);
      if (!env) continue;

      const tools = this.generateTools(index, env);
      allTools.set(id, tools);
    }

    return allTools;
  }

  /**
   * Customize a tool description based on the specific codebase.
   */
  private customizeDescription(template: ToolTemplate, index: CodebaseIndex): string {
    let desc = template.description;

    // Add codebase-specific context
    if (index.techStack.framework.length > 0) {
      desc += ` Optimized for ${index.techStack.framework.join(", ")} codebases.`;
    }

    if (index.type === "service" && template.name.includes("route")) {
      desc += ` Detects Hono route definitions in ${index.name}.`;
    }

    return desc;
  }

  /**
   * Get a summary of tools generated for a codebase.
   */
  getToolSummary(tools: ToolDefinition[]): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const tool of tools) {
      summary[tool.category] = (summary[tool.category] || 0) + 1;
    }
    return summary;
  }
}
