/**
 * Codebase Harness - Core Type Definitions
 *
 * Defines the fundamental types used across the harness system for
 * codebase indexing, environment management, tool generation, and skill registration.
 */

// ============================================================================
// Codebase Identity & Classification
// ============================================================================

/** Classification of codebase type based on analysis */
export type CodebaseType =
  | "library"
  | "application"
  | "service"
  | "cli"
  | "sdk"
  | "ui-components"
  | "documentation"
  | "infrastructure"
  | "protocol"
  | "monorepo-root"
  | "unknown";

/** Technology stack detected in a codebase */
export interface TechStack {
  language: string;
  runtime: string[];
  framework: string[];
  buildTools: string[];
  testingFrameworks: string[];
  linters: string[];
  bundlers: string[];
}

/** Dependency information for a codebase */
export interface DependencyInfo {
  name: string;
  version: string;
  isDev: boolean;
  isWorkspace: boolean;
  category: "core" | "ui" | "testing" | "build" | "dev" | "runtime" | "ai" | "database" | "network" | "utility";
}

/** Structural metrics for a codebase */
export interface CodebaseMetrics {
  fileCount: number;
  lineCount: number;
  tsFileCount: number;
  tsxFileCount: number;
  testFileCount: number;
  configFiles: string[];
  entryPoints: string[];
  exportedSymbols: number;
  averageFileLines: number;
  maxFileLines: number;
  directoryDepth: number;
}

/** Patterns detected in the codebase */
export interface CodebasePatterns {
  architecturePattern: "effect-ts" | "functional" | "oop" | "reactive" | "mixed" | "unknown";
  stateManagement: string[];
  apiPatterns: string[];
  errorHandlingPattern: string[];
  configurationPattern: "env" | "config-file" | "cli-args" | "mixed";
  eventPatterns: string[];
  databasePatterns: string[];
  authPatterns: string[];
}

/** Complete index of a codebase */
export interface CodebaseIndex {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  description: string;
  type: CodebaseType;
  version: string;
  isPrivate: boolean;
  techStack: TechStack;
  dependencies: DependencyInfo[];
  metrics: CodebaseMetrics;
  patterns: CodebasePatterns;
  entryPoints: string[];
  exports: ExportInfo[];
  testCoverage: TestCoverageInfo;
  hasCI: boolean;
  hasLinting: boolean;
  hasTypeChecking: boolean;
  indexedAt: Date;
}

/** Information about an exported symbol */
export interface ExportInfo {
  name: string;
  kind: "function" | "class" | "interface" | "type" | "constant" | "enum" | "variable";
  filePath: string;
  isDefault: boolean;
  hasJSDoc: boolean;
  parameterCount?: number;
}

/** Test coverage information */
export interface TestCoverageInfo {
  hasTests: boolean;
  testFiles: string[];
  testFramework: string;
  estimatedCoverage: "none" | "low" | "medium" | "high";
}

// ============================================================================
// Environment Types
// ============================================================================

/** Isolation level for environments */
export type IsolationLevel = "full" | "network" | "filesystem" | "process" | "none";

/** Environment status */
export type EnvironmentStatus =
  | "creating"
  | "ready"
  | "running"
  | "paused"
  | "error"
  | "destroyed";

/** Configuration for an isolated environment */
export interface EnvironmentConfig {
  id: string;
  codebaseId: string;
  name: string;
  isolationLevel: IsolationLevel;
  workDir: string;
  envVars: Record<string, string>;
  allowedCommands: string[];
  deniedCommands: string[];
  resourceLimits: ResourceLimits;
  networkPolicy: NetworkPolicy;
  fileAccessPolicy: FileAccessPolicy;
  preInstalledTools: string[];
  startupCommands: string[];
}

/** Resource limits for an environment */
export interface ResourceLimits {
  maxMemoryMB: number;
  maxCPUPercent: number;
  maxDiskMB: number;
  maxProcesses: number;
  maxOpenFiles: number;
  timeoutMs: number;
}

/** Network access policy */
export interface NetworkPolicy {
  allowOutbound: boolean;
  allowedHosts: string[];
  blockedPorts: number[];
  proxy?: string;
}

/** File system access policy */
export interface FileAccessPolicy {
  readPaths: string[];
  writePaths: string[];
  denyPaths: string[];
  readOnly: boolean;
}

/** Active environment state */
export interface Environment {
  config: EnvironmentConfig;
  status: EnvironmentStatus;
  pid?: number;
  ports: number[];
  startedAt?: Date;
  lastActivity?: Date;
  toolCount: number;
  skillCount: number;
  healthStatus: HealthStatus;
}

/** Health status of an environment */
export interface HealthStatus {
  isHealthy: boolean;
  lastCheck: Date;
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  passed: boolean;
  message?: string;
  durationMs: number;
}

// ============================================================================
// Tool Types
// ============================================================================

/** Category of a tool */
export type ToolCategory =
  | "navigation"
  | "analysis"
  | "transformation"
  | "testing"
  | "build"
  | "deployment"
  | "debugging"
  | "documentation"
  | "refactoring"
  | "search"
  | "generation"
  | "validation"
  | "monitoring";

/** Parameter definition for a tool */
export interface ToolParameter {
  name: string;
  description: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "enum";
  required: boolean;
  default?: unknown;
  enumValues?: string[];
  constraints?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/** Definition of a codebase-specific tool */
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  codebaseId: string;
  environmentId: string;
  parameters: ToolParameter[];
  returnType: string;
  implementation: string;
  dependencies: string[];
  isReadOnly: boolean;
  requiresNetwork: boolean;
  timeoutMs: number;
  tags: string[];
}

/** Result of executing a tool */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTimeMs: number;
  environmentId: string;
  toolId: string;
}

// ============================================================================
// Skill Types
// ============================================================================

/** Skill capability level */
export type SkillLevel = "basic" | "intermediate" | "advanced" | "expert";

/** Definition of a codebase-specific skill */
export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  codebaseId: string;
  level: SkillLevel;
  category: string;
  tools: string[]; // Tool IDs this skill uses
  triggers: string[]; // Patterns that activate this skill
  prompt: string; // System prompt enhancement for this skill
  examples: SkillExample[];
  constraints: string[];
  prerequisites: string[]; // Other skill IDs needed
}

/** Example usage of a skill */
export interface SkillExample {
  input: string;
  expectedOutput: string;
  description: string;
}

// ============================================================================
// Registry Types
// ============================================================================

/** Registry entry for a codebase */
export interface RegistryEntry {
  codebaseId: string;
  codebaseName: string;
  environment: Environment;
  tools: ToolDefinition[];
  skills: SkillDefinition[];
  registeredAt: Date;
  lastUpdated: Date;
}

/** Query for searching the registry */
export interface RegistryQuery {
  codebaseId?: string;
  toolCategory?: ToolCategory;
  skillLevel?: SkillLevel;
  tags?: string[];
  search?: string;
}

// ============================================================================
// Harness Engine Types
// ============================================================================

/** Configuration for the harness engine */
export interface HarnessConfig {
  rootPath: string;
  discoveryPatterns: string[];
  defaultIsolationLevel: IsolationLevel;
  maxConcurrentEnvironments: number;
  autoIndexOnStartup: boolean;
  cacheDirectory: string;
  logLevel: "debug" | "info" | "warn" | "error";
}

/** Events emitted by the harness engine */
export type HarnessEvent =
  | { type: "codebase-discovered"; codebaseId: string; path: string }
  | { type: "codebase-indexed"; codebaseId: string; index: CodebaseIndex }
  | { type: "environment-created"; environmentId: string; codebaseId: string }
  | { type: "environment-ready"; environmentId: string }
  | { type: "environment-error"; environmentId: string; error: string }
  | { type: "tools-generated"; environmentId: string; count: number }
  | { type: "skills-generated"; environmentId: string; count: number }
  | { type: "tool-executed"; toolId: string; result: ToolResult };
