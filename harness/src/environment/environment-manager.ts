/**
 * Codebase Harness - Environment Manager
 *
 * Creates and manages isolated environments for each codebase. Each environment
 * has:
 * - Isolated working directory
 * - Scoped environment variables
 * - Resource limits
 * - Network access policies
 * - File system access controls
 * - Pre-installed tools
 *
 * Environments are isolated from each other to prevent interference and
 * ensure reproducible tool execution.
 */

import { mkdir, writeFile, readFile, readdir, rm, cp } from "fs/promises";
import { join, relative, basename } from "path";
import type {
  Environment,
  EnvironmentConfig,
  EnvironmentStatus,
  IsolationLevel,
  ResourceLimits,
  NetworkPolicy,
  FileAccessPolicy,
  HealthStatus,
  HealthCheck,
  CodebaseIndex,
  HarnessEvent,
} from "../types/index";
import { generateId, Logger, timestamp, readJson } from "../utils/index";

const log = new Logger("EnvironmentManager");

// ============================================================================
// Default Configurations by Codebase Type
// ============================================================================

const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  maxMemoryMB: 512,
  maxCPUPercent: 80,
  maxDiskMB: 1024,
  maxProcesses: 20,
  maxOpenFiles: 256,
  timeoutMs: 60_000,
};

const HEAVY_RESOURCE_LIMITS: ResourceLimits = {
  maxMemoryMB: 2048,
  maxCPUPercent: 100,
  maxDiskMB: 4096,
  maxProcesses: 50,
  maxOpenFiles: 1024,
  timeoutMs: 120_000,
};

function getResourceLimitsForType(codebaseType: string): ResourceLimits {
  switch (codebaseType) {
    case "application":
    case "service":
      return HEAVY_RESOURCE_LIMITS;
    case "ui-components":
      return { ...DEFAULT_RESOURCE_LIMITS, maxMemoryMB: 1024 };
    case "monorepo-root":
      return { ...HEAVY_RESOURCE_LIMITS, maxDiskMB: 8192 };
    default:
      return DEFAULT_RESOURCE_LIMITS;
  }
}

function getNetworkPolicyForType(codebaseType: string): NetworkPolicy {
  switch (codebaseType) {
    case "service":
      return {
        allowOutbound: true,
        allowedHosts: ["localhost", "127.0.0.1", "0.0.0.0"],
        blockedPorts: [22, 3306, 5432],
      };
    case "application":
    case "cli":
      return {
        allowOutbound: true,
        allowedHosts: [],
        blockedPorts: [22],
      };
    case "library":
    case "sdk":
    case "protocol":
      return {
        allowOutbound: false,
        allowedHosts: [],
        blockedPorts: [],
      };
    default:
      return {
        allowOutbound: false,
        allowedHosts: [],
        blockedPorts: [],
      };
  }
}

function getFileAccessPolicyForType(
  codebasePath: string,
  rootPath: string
): FileAccessPolicy {
  return {
    readPaths: [codebasePath, join(rootPath, "packages/util"), join(rootPath, "packages/protocol")],
    writePaths: [codebasePath],
    denyPaths: [
      join(codebasePath, "node_modules"),
      join(codebasePath, ".git"),
      join(rootPath, "node_modules"),
    ],
    readOnly: false,
  };
}

function getStartupCommandsForType(codebaseType: string, codebasePath: string): string[] {
  const commands: string[] = [];

  switch (codebaseType) {
    case "application":
    case "service":
      commands.push("bun install --frozen-lockfile");
      break;
    case "library":
    case "sdk":
    case "protocol":
      commands.push("bun install --frozen-lockfile");
      break;
    case "ui-components":
      commands.push("bun install --frozen-lockfile");
      break;
    default:
      commands.push("bun install --frozen-lockfile");
  }

  return commands;
}

function getAllowedCommandsForType(codebaseType: string): string[] {
  const base = [
    "bun",
    "node",
    "npx",
    "cat",
    "ls",
    "find",
    "grep",
    "head",
    "tail",
    "wc",
    "sort",
    "uniq",
    "awk",
    "sed",
    "echo",
    "mkdir",
    "touch",
    "diff",
    "jq",
  ];

  switch (codebaseType) {
    case "application":
    case "service":
      return [...base, "curl", "git", "bunx", "astro", "vite"];
    case "cli":
      return [...base, "git", "bunx"];
    case "library":
    case "sdk":
    case "protocol":
      return [...base, "bunx"];
    default:
      return base;
  }
}

// ============================================================================
// Environment Manager Class
// ============================================================================

export class EnvironmentManager {
  private rootPath: string;
  private environments: Map<string, Environment> = new Map();
  private envBaseDir: string;
  private eventCallbacks: ((event: HarnessEvent) => void)[] = [];

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.envBaseDir = join(rootPath, ".harness", "environments");
  }

  /** Register an event listener */
  onEvent(callback: (event: HarnessEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /** Emit an event */
  private emit(event: HarnessEvent): void {
    for (const cb of this.eventCallbacks) {
      try { cb(event); } catch { /* ignore listener errors */ }
    }
  }

  /**
   * Create an isolated environment for a codebase.
   */
  async createEnvironment(index: CodebaseIndex): Promise<Environment> {
    const envId = `env-${index.id}`;
    const envDir = join(this.envBaseDir, index.id);

    log.info(`Creating environment '${envId}' for codebase '${index.name}'`);

    this.emit({
      type: "environment-created",
      environmentId: envId,
      codebaseId: index.id,
    });

    // Create environment directory structure
    await mkdir(join(envDir, "workspace"), { recursive: true });
    await mkdir(join(envDir, "cache"), { recursive: true });
    await mkdir(join(envDir, "logs"), { recursive: true });
    await mkdir(join(envDir, "temp"), { recursive: true });
    await mkdir(join(envDir, "output"), { recursive: true });

    // Build environment config
    const config: EnvironmentConfig = {
      id: envId,
      codebaseId: index.id,
      name: `${index.name} environment`,
      isolationLevel: this.determineIsolationLevel(index),
      workDir: join(envDir, "workspace"),
      envVars: this.buildEnvVars(index, envDir),
      allowedCommands: getAllowedCommandsForType(index.type),
      deniedCommands: ["rm -rf", "sudo", "chmod 777", "mkfs", "dd"],
      resourceLimits: getResourceLimitsForType(index.type),
      networkPolicy: getNetworkPolicyForType(index.type),
      fileAccessPolicy: getFileAccessPolicyForType(index.path, this.rootPath),
      preInstalledTools: this.determinePreInstalledTools(index),
      startupCommands: getStartupCommandsForType(index.type, index.path),
    };

    // Write environment manifest
    await writeFile(
      join(envDir, "manifest.json"),
      JSON.stringify(config, null, 2)
    );

    // Write environment activation script
    await writeFile(
      join(envDir, "activate.sh"),
      this.generateActivationScript(config)
    );

    // Create the environment object
    const env: Environment = {
      config,
      status: "ready",
      ports: [],
      startedAt: new Date(),
      lastActivity: new Date(),
      toolCount: 0,
      skillCount: 0,
      healthStatus: {
        isHealthy: true,
        lastCheck: new Date(),
        checks: [
          { name: "directory-created", passed: true, durationMs: 0 },
          { name: "manifest-written", passed: true, durationMs: 0 },
        ],
      },
    };

    this.environments.set(envId, env);
    log.info(`Environment '${envId}' is ready`);

    this.emit({ type: "environment-ready", environmentId: envId });

    return env;
  }

  /**
   * Get an existing environment.
   */
  getEnvironment(envId: string): Environment | undefined {
    return this.environments.get(envId);
  }

  /**
   * Get all environments.
   */
  getAllEnvironments(): Environment[] {
    return Array.from(this.environments.values());
  }

  /**
   * Get environment by codebase ID.
   */
  getEnvironmentByCodebase(codebaseId: string): Environment | undefined {
    return Array.from(this.environments.values()).find(
      (e) => e.config.codebaseId === codebaseId
    );
  }

  /**
   * Update environment status.
   */
  updateStatus(envId: string, status: EnvironmentStatus): void {
    const env = this.environments.get(envId);
    if (env) {
      env.status = status;
      env.lastActivity = new Date();
    }
  }

  /**
   * Run health checks on an environment.
   */
  async healthCheck(envId: string): Promise<HealthStatus> {
    const env = this.environments.get(envId);
    if (!env) {
      return {
        isHealthy: false,
        lastCheck: new Date(),
        checks: [{ name: "exists", passed: false, message: "Environment not found", durationMs: 0 }],
      };
    }

    const checks: HealthCheck[] = [];
    const start = Date.now();

    // Check workspace directory exists
    try {
      await readdir(env.config.workDir);
      checks.push({ name: "workspace-accessible", passed: true, durationMs: Date.now() - start });
    } catch {
      checks.push({ name: "workspace-accessible", passed: false, message: "Cannot access workspace", durationMs: Date.now() - start });
    }

    // Check manifest exists
    try {
      await readFile(join(this.envBaseDir, env.config.codebaseId, "manifest.json"));
      checks.push({ name: "manifest-valid", passed: true, durationMs: Date.now() - start });
    } catch {
      checks.push({ name: "manifest-valid", passed: false, message: "Manifest missing", durationMs: Date.now() - start });
    }

    const isHealthy = checks.every((c) => c.passed);
    env.healthStatus = { isHealthy, lastCheck: new Date(), checks };

    return env.healthStatus;
  }

  /**
   * Destroy an environment and clean up its resources.
   */
  async destroyEnvironment(envId: string): Promise<void> {
    const env = this.environments.get(envId);
    if (!env) return;

    log.info(`Destroying environment '${envId}'`);

    try {
      await rm(join(this.envBaseDir, env.config.codebaseId), { recursive: true, force: true });
    } catch (err) {
      log.warn(`Failed to clean up environment directory: ${err}`);
    }

    env.status = "destroyed";
    this.environments.delete(envId);
  }

  /**
   * Update tool/skill counts on an environment.
   */
  updateCounts(envId: string, toolCount: number, skillCount: number): void {
    const env = this.environments.get(envId);
    if (env) {
      env.toolCount = toolCount;
      env.skillCount = skillCount;
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private determineIsolationLevel(index: CodebaseIndex): IsolationLevel {
    switch (index.type) {
      case "service":
      case "application":
        return "process";
      case "library":
      case "sdk":
      case "protocol":
        return "filesystem";
      default:
        return "filesystem";
    }
  }

  private buildEnvVars(index: CodebaseIndex, envDir: string): Record<string, string> {
    return {
      HARNESS_ENV_ID: `env-${index.id}`,
      HARNESS_CODEBASE_ID: index.id,
      HARNESS_CODEBASE_NAME: index.name,
      HARNESS_CODEBASE_TYPE: index.type,
      HARNESS_WORK_DIR: join(envDir, "workspace"),
      HARNESS_CACHE_DIR: join(envDir, "cache"),
      HARNESS_LOG_DIR: join(envDir, "logs"),
      HARNESS_TEMP_DIR: join(envDir, "temp"),
      HARNESS_OUTPUT_DIR: join(envDir, "output"),
      HARNESS_ROOT_PATH: this.rootPath,
      HARNESS_CODEBASE_PATH: index.path,
      NODE_ENV: "development",
      BUN_INSTALL_CACHE_DIR: join(envDir, "cache", "bun"),
    };
  }

  private determinePreInstalledTools(index: CodebaseIndex): string[] {
    const tools: string[] = [
      "file-read",
      "file-search",
      "pattern-search",
      "dependency-list",
    ];

    // Add type-specific tools
    switch (index.type) {
      case "application":
      case "service":
        tools.push(
          "route-list",
          "endpoint-test",
          "build-runner",
          "dev-server",
          "log-tail"
        );
        break;
      case "library":
      case "sdk":
        tools.push(
          "export-list",
          "api-analyzer",
          "breaking-change-detector",
          "bundle-analyzer"
        );
        break;
      case "cli":
        tools.push(
          "command-list",
          "flag-parser",
          "cli-test-runner"
        );
        break;
      case "ui-components":
        tools.push(
          "component-list",
          "prop-analyzer",
          "storybook-runner",
          "visual-regression"
        );
        break;
      case "protocol":
        tools.push(
          "schema-validator",
          "endpoint-diff",
          "protocol-codegen"
        );
        break;
      case "documentation":
        tools.push(
          "doc-link-checker",
          "content-analyzer",
          "build-preview"
        );
        break;
      case "monorepo-root":
        tools.push(
          "workspace-graph",
          "dependency-graph",
          "turbo-runner",
          "cross-package-search"
        );
        break;
    }

    // Add test tools if codebase has tests
    if (index.testCoverage.hasTests) {
      tools.push("test-runner", "coverage-reporter");
    }

    // Add linting tools if configured
    if (index.hasLinting) {
      tools.push("lint-runner", "format-checker");
    }

    // Add type checking tools
    if (index.hasTypeChecking) {
      tools.push("type-checker", "type-errors-parser");
    }

    return tools;
  }

  private generateActivationScript(config: EnvironmentConfig): string {
    const lines = [
      "#!/bin/bash",
      `# Environment activation script for: ${config.name}`,
      `# Generated: ${timestamp()}`,
      "",
      `export HARNESS_ENV_ID="${config.id}"`,
      `export HARNESS_WORK_DIR="${config.workDir}"`,
      "",
    ];

    for (const [key, value] of Object.entries(config.envVars)) {
      lines.push(`export ${key}="${value}"`);
    }

    lines.push("");
    lines.push(`cd "${config.workDir}"`);
    lines.push("");
    lines.push("# Run startup commands");
    for (const cmd of config.startupCommands) {
      lines.push(cmd);
    }

    return lines.join("\n") + "\n";
  }
}
