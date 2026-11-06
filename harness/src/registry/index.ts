/**
 * Codebase Harness - Registry
 *
 * Central registry that tracks all codebases, their environments, tools,
 * and skills. Provides querying and lookup capabilities for the entire
 * harness system.
 */

import type {
  RegistryEntry,
  RegistryQuery,
  CodebaseIndex,
  Environment,
  ToolDefinition,
  SkillDefinition,
  ToolCategory,
  SkillLevel,
} from "../types/index";
import { Logger, timestamp } from "../utils/index";

const log = new Logger("Registry");

/**
 * Central registry for all codebase harness entries.
 */
export class HarnessRegistry {
  private entries: Map<string, RegistryEntry> = new Map();

  /**
   * Register a new codebase entry in the registry.
   */
  register(
    index: CodebaseIndex,
    environment: Environment,
    tools: ToolDefinition[],
    skills: SkillDefinition[]
  ): RegistryEntry {
    const entry: RegistryEntry = {
      codebaseId: index.id,
      codebaseName: index.name,
      environment,
      tools,
      skills,
      registeredAt: new Date(),
      lastUpdated: new Date(),
    };

    this.entries.set(index.id, entry);
    log.info(`Registered '${index.name}' — ${tools.length} tools, ${skills.length} skills`);
    return entry;
  }

  /**
   * Get a registry entry by codebase ID.
   */
  get(codebaseId: string): RegistryEntry | undefined {
    return this.entries.get(codebaseId);
  }

  /**
   * Get a registry entry by codebase name.
   */
  getByName(name: string): RegistryEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.codebaseName === name) return entry;
    }
    return undefined;
  }

  /**
   * Get all registered entries.
   */
  getAll(): RegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Query the registry with filters.
   */
  query(q: RegistryQuery): RegistryEntry[] {
    let results = Array.from(this.entries.values());

    if (q.codebaseId) {
      results = results.filter((e) => e.codebaseId === q.codebaseId);
    }

    if (q.toolCategory) {
      results = results.filter((e) =>
        e.tools.some((t) => t.category === q.toolCategory)
      );
    }

    if (q.skillLevel) {
      results = results.filter((e) =>
        e.skills.some((s) => s.level === q.skillLevel)
      );
    }

    if (q.tags && q.tags.length > 0) {
      results = results.filter((e) =>
        e.tools.some((t) => q.tags!.some((tag) => t.tags.includes(tag)))
      );
    }

    if (q.search) {
      const term = q.search.toLowerCase();
      results = results.filter(
        (e) =>
          e.codebaseName.toLowerCase().includes(term) ||
          e.tools.some((t) => t.name.toLowerCase().includes(term) || t.description.toLowerCase().includes(term)) ||
          e.skills.some((s) => s.name.toLowerCase().includes(term) || s.description.toLowerCase().includes(term))
      );
    }

    return results;
  }

  /**
   * Find a specific tool by name across all codebases.
   */
  findTool(toolName: string, codebaseId?: string): ToolDefinition | undefined {
    if (codebaseId) {
      const entry = this.entries.get(codebaseId);
      if (entry) return entry.tools.find((t) => t.name === toolName);
    }

    for (const entry of this.entries.values()) {
      const tool = entry.tools.find((t) => t.name === toolName);
      if (tool) return tool;
    }
    return undefined;
  }

  /**
   * Find a specific skill by name across all codebases.
   */
  findSkill(skillName: string, codebaseId?: string): SkillDefinition | undefined {
    if (codebaseId) {
      const entry = this.entries.get(codebaseId);
      if (entry) return entry.skills.find((s) => s.name === skillName);
    }

    for (const entry of this.entries.values()) {
      const skill = entry.skills.find((s) => s.name === skillName);
      if (skill) return skill;
    }
    return undefined;
  }

  /**
   * Get all tools across all codebases.
   */
  getAllTools(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const entry of this.entries.values()) {
      tools.push(...entry.tools);
    }
    return tools;
  }

  /**
   * Get all skills across all codebases.
   */
  getAllSkills(): SkillDefinition[] {
    const skills: SkillDefinition[] = [];
    for (const entry of this.entries.values()) {
      skills.push(...entry.skills);
    }
    return skills;
  }

  /**
   * Update an existing entry's tools and skills.
   */
  update(codebaseId: string, tools: ToolDefinition[], skills: SkillDefinition[]): void {
    const entry = this.entries.get(codebaseId);
    if (entry) {
      entry.tools = tools;
      entry.skills = skills;
      entry.lastUpdated = new Date();
      log.info(`Updated '${entry.codebaseName}' — ${tools.length} tools, ${skills.length} skills`);
    }
  }

  /**
   * Remove a codebase from the registry.
   */
  unregister(codebaseId: string): boolean {
    const existed = this.entries.delete(codebaseId);
    if (existed) {
      log.info(`Unregistered codebase '${codebaseId}'`);
    }
    return existed;
  }

  /**
   * Get aggregate statistics for the entire registry.
   */
  getStats(): RegistryStats {
    const allTools = this.getAllTools();
    const allSkills = this.getAllSkills();

    const toolCategories: Record<string, number> = {};
    for (const t of allTools) {
      toolCategories[t.category] = (toolCategories[t.category] || 0) + 1;
    }

    const skillLevels: Record<string, number> = {};
    for (const s of allSkills) {
      skillLevels[s.level] = (skillLevels[s.level] || 0) + 1;
    }

    const codebaseTypes: Record<string, number> = {};
    for (const entry of this.entries.values()) {
      const env = entry.environment;
      const type = entry.codebaseName; // We don't store type directly on entry
      codebaseTypes[type] = (codebaseTypes[type] || 0) + 1;
    }

    return {
      totalCodebases: this.entries.size,
      totalTools: allTools.length,
      totalSkills: allSkills.length,
      toolCategories,
      skillLevels,
      codebaseNames: Array.from(this.entries.values()).map((e) => e.codebaseName),
    };
  }

  /**
   * Generate a human-readable report of the registry.
   */
  generateReport(): string {
    const stats = this.getStats();
    const lines: string[] = [];

    lines.push("╔══════════════════════════════════════════════════════════════╗");
    lines.push("║              CODEBASE HARNESS REGISTRY REPORT               ║");
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    lines.push(`║  Total Codebases: ${String(stats.totalCodebases).padEnd(44)}║`);
    lines.push(`║  Total Tools:     ${String(stats.totalTools).padEnd(44)}║`);
    lines.push(`║  Total Skills:    ${String(stats.totalSkills).padEnd(44)}║`);
    lines.push("╠══════════════════════════════════════════════════════════════╣");
    lines.push("║  REGISTERED CODEBASES                                       ║");

    for (const entry of this.entries.values()) {
      const name = entry.codebaseName.length > 40 ? entry.codebaseName.substring(0, 37) + "..." : entry.codebaseName;
      lines.push(`║  • ${name.padEnd(56)}║`);
      lines.push(`║    Tools: ${entry.tools.length} | Skills: ${entry.skills.length} | Env: ${entry.environment.status.padEnd(28)}║`);
    }

    lines.push("╠══════════════════════════════════════════════════════════════╣");
    lines.push("║  TOOL CATEGORIES                                            ║");
    for (const [cat, count] of Object.entries(stats.toolCategories)) {
      lines.push(`║  ${cat.padEnd(20)} ${String(count).padEnd(37)}║`);
    }

    lines.push("╠══════════════════════════════════════════════════════════════╣");
    lines.push("║  SKILL LEVELS                                               ║");
    for (const [level, count] of Object.entries(stats.skillLevels)) {
      lines.push(`║  ${level.padEnd(20)} ${String(count).padEnd(37)}║`);
    }

    lines.push("╚══════════════════════════════════════════════════════════════╝");

    return lines.join("\n");
  }
}

/** Aggregate statistics */
export interface RegistryStats {
  totalCodebases: number;
  totalTools: number;
  totalSkills: number;
  toolCategories: Record<string, number>;
  skillLevels: Record<string, number>;
  codebaseNames: string[];
}
