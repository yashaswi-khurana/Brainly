/**
 * Codebase Harness - Main Engine
 *
 * The central orchestrator that ties together all components:
 * 1. Discovers and indexes codebases (CodebaseIndexer)
 * 2. Creates isolated environments (EnvironmentManager)
 * 3. Generates codebase-specific tools (ToolGenerator)
 * 4. Generates codebase-specific skills (SkillGenerator)
 * 5. Registers everything in the Registry (HarnessRegistry)
 *
 * Usage:
 *   const harness = new HarnessEngine({ rootPath: "/path/to/monorepo" });
 *   await harness.initialize();
 *   const report = harness.generateReport();
 */

import { join } from "path";
import type {
  HarnessConfig,
  HarnessEvent,
  CodebaseIndex,
  Environment,
  ToolDefinition,
  SkillDefinition,
} from "./types/index";
import { CodebaseIndexer } from "./indexer/codebase-indexer";
import { EnvironmentManager } from "./environment/environment-manager";
import { ToolGenerator } from "./tools/tool-generator";
import { SkillGenerator } from "./skills/skill-generator";
import { HarnessRegistry } from "./registry/index";
import { Logger, timestamp } from "./utils/index";

const log = new Logger("HarnessEngine");

/**
 * Main harness engine that orchestrates the full pipeline.
 */
export class HarnessEngine {
  private config: HarnessConfig;
  private indexer: CodebaseIndexer;
  private envManager: EnvironmentManager;
  private toolGenerator: ToolGenerator;
  private skillGenerator: SkillGenerator;
  private registry: HarnessRegistry;
  private eventCallbacks: ((event: HarnessEvent) => void)[] = [];
  private initialized = false;

  // Cached state
  private indices: Map<string, CodebaseIndex> = new Map();
  private environments: Map<string, Environment> = new Map();
  private allTools: Map<string, ToolDefinition[]> = new Map();
  private allSkills: Map<string, SkillDefinition[]> = new Map();

  constructor(config: Partial<HarnessConfig> & { rootPath: string }) {
    this.config = {
      rootPath: config.rootPath,
      discoveryPatterns: config.discoveryPatterns || ["packages/*", "services/*", "sdks/*"],
      defaultIsolationLevel: config.defaultIsolationLevel || "filesystem",
      maxConcurrentEnvironments: config.maxConcurrentEnvironments || 10,
      autoIndexOnStartup: config.autoIndexOnStartup ?? true,
      cacheDirectory: config.cacheDirectory || join(config.rootPath, ".harness", "cache"),
      logLevel: config.logLevel || "info",
    };

    this.indexer = new CodebaseIndexer(this.config.rootPath);
    this.envManager = new EnvironmentManager(this.config.rootPath);
    this.toolGenerator = new ToolGenerator(this.config.rootPath);
    this.skillGenerator = new SkillGenerator(this.config.rootPath);
    this.registry = new HarnessRegistry();

    // Forward environment events
    this.envManager.onEvent((e) => this.emit(e));
  }

  /** Register an event listener */
  onEvent(callback: (event: HarnessEvent) => void): void {
    this.eventCallbacks.push(callback);
  }

  /** Emit an event to all listeners */
  private emit(event: HarnessEvent): void {
    for (const cb of this.eventCallbacks) {
      try { cb(event); } catch { /* ignore */ }
    }
  }

  /**
   * Initialize the harness: discover, index, create environments, generate tools & skills.
   */
  async initialize(): Promise<HarnessResult> {
    log.info("═══════════════════════════════════════════════════════");
    log.info("  CODEBASE HARNESS ENGINE — INITIALIZATION STARTING");
    log.info("═══════════════════════════════════════════════════════");

    const startTime = Date.now();

    // Phase 1: Discovery & Indexing
    log.info("Phase 1: Discovering and indexing codebases...");
    this.indices = await this.indexer.indexAll();
    log.info(`Discovered and indexed ${this.indices.size} codebases`);

    for (const [id, index] of this.indices) {
      this.emit({ type: "codebase-indexed", codebaseId: id, index });
    }

    // Phase 2: Environment Creation
    log.info("Phase 2: Creating isolated environments...");
    for (const [id, index] of this.indices) {
      try {
        const env = await this.envManager.createEnvironment(index);
        this.environments.set(env.config.id, env);
      } catch (err) {
        log.error(`Failed to create environment for ${index.name}: ${err}`);
        this.emit({
          type: "environment-error",
          environmentId: `env-${id}`,
          error: String(err),
        });
      }
    }
    log.info(`Created ${this.environments.size} environments`);

    // Phase 3: Tool Generation
    log.info("Phase 3: Generating codebase-specific tools...");
    this.allTools = this.toolGenerator.generateAllTools(this.indices, this.environments);
    let totalTools = 0;
    for (const [id, tools] of this.allTools) {
      totalTools += tools.length;
      const env = this.environments.get(`env-${id}`);
      if (env) {
        this.emit({ type: "tools-generated", environmentId: env.config.id, count: tools.length });
      }
    }
    log.info(`Generated ${totalTools} tools across all codebases`);

    // Phase 4: Skill Generation
    log.info("Phase 4: Generating codebase-specific skills...");
    this.allSkills = this.skillGenerator.generateAllSkills(this.indices, this.allTools, this.environments);
    let totalSkills = 0;
    for (const [id, skills] of this.allSkills) {
      totalSkills += skills.length;
      const env = this.environments.get(`env-${id}`);
      if (env) {
        this.emit({ type: "skills-generated", environmentId: env.config.id, count: skills.length });
      }
    }
    log.info(`Generated ${totalSkills} skills across all codebases`);

    // Phase 5: Registry
    log.info("Phase 5: Registering all components...");
    for (const [id, index] of this.indices) {
      const env = this.environments.get(`env-${id}`);
      const tools = this.allTools.get(id) || [];
      const skills = this.allSkills.get(id) || [];
      if (env) {
        this.registry.register(index, env, tools, skills);
        this.envManager.updateCounts(env.config.id, tools.length, skills.length);
      }
    }

    const elapsed = Date.now() - startTime;
    this.initialized = true;

    log.info("═══════════════════════════════════════════════════════");
    log.info(`  INITIALIZATION COMPLETE in ${elapsed}ms`);
    log.info(`  Codebases: ${this.indices.size}`);
    log.info(`  Environments: ${this.environments.size}`);
    log.info(`  Tools: ${totalTools}`);
    log.info(`  Skills: ${totalSkills}`);
    log.info("═══════════════════════════════════════════════════════");

    return {
      codebaseCount: this.indices.size,
      environmentCount: this.environments.size,
      toolCount: totalTools,
      skillCount: totalSkills,
      elapsedMs: elapsed,
      indices: this.indices,
    };
  }

  // ========================================================================
  // Accessors
  // ========================================================================

  /** Get the registry */
  getRegistry(): HarnessRegistry {
    return this.registry;
  }

  /** Get the environment manager */
  getEnvironmentManager(): EnvironmentManager {
    return this.envManager;
  }

  /** Get all codebase indices */
  getIndices(): Map<string, CodebaseIndex> {
    return this.indices;
  }

  /** Get a specific codebase index */
  getIndex(codebaseId: string): CodebaseIndex | undefined {
    return this.indices.get(codebaseId);
  }

  /** Get all environments */
  getEnvironments(): Map<string, Environment> {
    return this.environments;
  }

  /** Get all tools for a codebase */
  getTools(codebaseId: string): ToolDefinition[] {
    return this.allTools.get(codebaseId) || [];
  }

  /** Get all skills for a codebase */
  getSkills(codebaseId: string): SkillDefinition[] {
    return this.allSkills.get(codebaseId) || [];
  }

  /** Check if initialized */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ========================================================================
  // Reporting
  // ========================================================================

  /**
   * Generate a comprehensive report of the harness state.
   */
  generateReport(): string {
    const lines: string[] = [];

    lines.push("");
    lines.push("╔════════════════════════════════════════════════════════════════════════╗");
    lines.push("║                   CODEBASE HARNESS SYSTEM REPORT                      ║");
    lines.push("╠════════════════════════════════════════════════════════════════════════╣");
    lines.push("");

    // Registry summary
    lines.push(this.registry.generateReport());
    lines.push("");

    // Per-codebase details
    lines.push("┌────────────────────────────────────────────────────────────────────────┐");
    lines.push("│ CODEBASE DETAILS                                                       │");
    lines.push("└────────────────────────────────────────────────────────────────────────┘");

    for (const [id, index] of this.indices) {
      const tools = this.allTools.get(id) || [];
      const skills = this.allSkills.get(id) || [];
      const env = this.environments.get(`env-${id}`);

      lines.push("");
      lines.push(`  📦 ${index.name}`);
      lines.push(`     Path: ${index.relativePath}`);
      lines.push(`     Type: ${index.type}`);
      lines.push(`     Version: ${index.version}`);
      lines.push(`     Language: ${index.techStack.language}`);
      lines.push(`     Frameworks: ${index.techStack.framework.join(", ") || "N/A"}`);
      lines.push(`     Architecture: ${index.patterns.architecturePattern}`);
      lines.push(`     Files: ${index.metrics.fileCount} | Lines: ${index.metrics.lineCount.toLocaleString()}`);
      lines.push(`     Exports: ${index.metrics.exportedSymbols} | Tests: ${index.testCoverage.estimatedCoverage}`);
      lines.push(`     Environment: ${env ? env.config.id : "N/A"} (${env?.status || "N/A"})`);
      lines.push(`     Isolation: ${env?.config.isolationLevel || "N/A"}`);
      lines.push(`     Tools (${tools.length}):`);

      // Group tools by category
      const byCategory: Record<string, string[]> = {};
      for (const t of tools) {
        if (!byCategory[t.category]) byCategory[t.category] = [];
        byCategory[t.category].push(t.name);
      }
      for (const [cat, names] of Object.entries(byCategory)) {
        lines.push(`       ${cat}: ${names.join(", ")}`);
      }

      lines.push(`     Skills (${skills.length}):`);
      for (const s of skills) {
        lines.push(`       [${s.level}] ${s.name} — ${s.description.substring(0, 60)}...`);
      }
    }

    lines.push("");
    lines.push("════════════════════════════════════════════════════════════════════════");

    return lines.join("\n");
  }

  /**
   * Generate a JSON export of the full harness state.
   */
  exportJSON(): object {
    const codebases: object[] = [];

    for (const [id, index] of this.indices) {
      const tools = this.allTools.get(id) || [];
      const skills = this.allSkills.get(id) || [];
      const env = this.environments.get(`env-${id}`);

      codebases.push({
        id: index.id,
        name: index.name,
        path: index.relativePath,
        type: index.type,
        version: index.version,
        techStack: index.techStack,
        architecture: index.patterns.architecturePattern,
        metrics: index.metrics,
        environment: env ? {
          id: env.config.id,
          status: env.status,
          isolationLevel: env.config.isolationLevel,
          resourceLimits: env.config.resourceLimits,
        } : null,
        tools: tools.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          description: t.description,
          isReadOnly: t.isReadOnly,
          parameters: t.parameters.map((p) => ({ name: p.name, type: p.type, required: p.required })),
        })),
        skills: skills.map((s) => ({
          id: s.id,
          name: s.name,
          level: s.level,
          category: s.category,
          description: s.description,
          toolCount: s.tools.length,
        })),
      });
    }

    return {
      generatedAt: timestamp(),
      rootPath: this.config.rootPath,
      summary: {
        totalCodebases: this.indices.size,
        totalEnvironments: this.environments.size,
        totalTools: Array.from(this.allTools.values()).reduce((s, t) => s + t.length, 0),
        totalSkills: Array.from(this.allSkills.values()).reduce((s, t) => s + t.length, 0),
      },
      codebases,
    };
  }

  /**
   * Re-index and regenerate for a specific codebase (hot reload).
   */
  async refresh(codebaseId: string): Promise<void> {
    const index = this.indices.get(codebaseId);
    if (!index) {
      log.warn(`Cannot refresh unknown codebase: ${codebaseId}`);
      return;
    }

    log.info(`Refreshing codebase '${index.name}'...`);

    // Re-index
    const newIndex = await this.indexer.indexCodebase(index.path);
    this.indices.set(codebaseId, newIndex);

    // Regenerate tools
    const env = this.environments.get(`env-${codebaseId}`);
    if (env) {
      const tools = this.toolGenerator.generateTools(newIndex, env);
      this.allTools.set(codebaseId, tools);

      // Regenerate skills
      const skills = this.skillGenerator.generateSkills(newIndex, tools, env);
      this.allSkills.set(codebaseId, skills);

      // Update registry
      this.registry.update(codebaseId, tools, skills);
      this.envManager.updateCounts(env.config.id, tools.length, skills.length);
    }

    log.info(`Refreshed '${index.name}' successfully`);
  }
}

/** Result of harness initialization */
export interface HarnessResult {
  codebaseCount: number;
  environmentCount: number;
  toolCount: number;
  skillCount: number;
  elapsedMs: number;
  indices: Map<string, CodebaseIndex>;
}
