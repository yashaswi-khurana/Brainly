/**
 * Codebase Harness System - Main Entry Point
 *
 * This module provides the public API for the Codebase Harness system.
 * It orchestrates the full pipeline of:
 *   1. Discovering codebases in a monorepo
 *   2. Indexing each codebase (tech stack, patterns, metrics)
 *   3. Creating isolated environments per codebase
 *   4. Generating codebase-specific tools
 *   5. Generating codebase-specific skills
 *   6. Registering everything in a central registry
 */

export { HarnessEngine } from "./engine";
export type { HarnessResult } from "./engine";

export { CodebaseIndexer } from "./indexer/codebase-indexer";
export { EnvironmentManager } from "./environment/environment-manager";
export { ToolGenerator } from "./tools/tool-generator";
export { SkillGenerator } from "./skills/skill-generator";
export { HarnessRegistry } from "./registry/index";
export type { RegistryStats } from "./registry/index";

export { Logger, generateId, pathToSlug, timestamp } from "./utils/index";

export type {
  // Core types
  CodebaseType,
  CodebaseIndex,
  TechStack,
  DependencyInfo,
  CodebaseMetrics,
  CodebasePatterns,
  ExportInfo,
  TestCoverageInfo,

  // Environment types
  Environment,
  EnvironmentConfig,
  EnvironmentStatus,
  IsolationLevel,
  ResourceLimits,
  NetworkPolicy,
  FileAccessPolicy,
  HealthStatus,

  // Tool types
  ToolDefinition,
  ToolCategory,
  ToolParameter,
  ToolResult,

  // Skill types
  SkillDefinition,
  SkillLevel,
  SkillExample,

  // Registry types
  RegistryEntry,
  RegistryQuery,

  // Engine types
  HarnessConfig,
  HarnessEvent,
} from "./types/index";
