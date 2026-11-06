/**
 * Codebase Harness - Skill Generator
 *
 * Generates codebase-specific skills that combine multiple tools into
 * higher-level capabilities. Skills represent domain expertise for working
 * with a particular codebase.
 *
 * Each skill includes:
 * - A set of tools it orchestrates
 * - Trigger patterns (when to activate the skill)
 * - An enhanced system prompt for AI agents
 * - Example inputs/outputs
 * - Constraints and prerequisites
 */

import type {
  SkillDefinition,
  SkillLevel,
  SkillExample,
  CodebaseIndex,
  ToolDefinition,
  Environment,
} from "../types/index";
import { generateId, Logger } from "../utils/index";

const log = new Logger("SkillGenerator");

// ============================================================================
// Skill Templates by Codebase Type
// ============================================================================

interface SkillTemplate {
  name: string;
  description: string;
  level: SkillLevel;
  category: string;
  toolPatterns: string[]; // patterns to match tool names
  triggers: string[];
  prompt: string;
  examples: SkillExample[];
  constraints: string[];
  prerequisiteTools: string[];
  applicableTypes: string[];
  applicableFrameworks?: string[];
}

const SKILL_TEMPLATES: SkillTemplate[] = [
  // ====== UNIVERSAL SKILLS ======
  {
    name: "codebase-orientation",
    description: "Quickly understand and orient within any codebase — explore structure, identify key modules, and understand the architecture",
    level: "basic",
    category: "navigation",
    toolPatterns: ["file-explorer", "codebase-summary", "dependency-analyzer"],
    triggers: [
      "understand this codebase",
      "what is this project",
      "show me the structure",
      "how is this organized",
      "explore the codebase",
      "give me an overview",
    ],
    prompt: `You are an expert code analyzer. When orienting within a codebase:
1. Start with the codebase-summary to understand the big picture
2. Use file-explorer to map the directory structure
3. Use dependency-analyzer to understand the tech stack
4. Use symbol-finder to identify key exports
5. Synthesize a clear mental model of the architecture

Always provide a concise summary with:
- What the codebase does
- How it's structured
- Key technologies used
- Important entry points
- Notable patterns`,
    examples: [
      {
        input: "What is this codebase about?",
        expectedOutput: "A comprehensive overview including purpose, architecture, key modules, and technology stack",
        description: "Basic orientation query",
      },
    ],
    constraints: [
      "Read-only operation — never modify files during orientation",
      "Limit exploration to 3 levels deep initially",
      "Summarize findings concisely",
    ],
    prerequisiteTools: [],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components", "protocol", "documentation", "infrastructure", "monorepo-root"],
  },

  {
    name: "pattern-detector",
    description: "Identify and document architectural patterns, design patterns, and conventions used in the codebase",
    level: "intermediate",
    category: "analysis",
    toolPatterns: ["codebase-summary", "symbol-finder", "dependency-analyzer"],
    triggers: [
      "what patterns are used",
      "detect patterns",
      "what architecture",
      "coding conventions",
      "how is state managed",
      "error handling approach",
    ],
    prompt: `You are an architecture analyst specializing in pattern detection. When analyzing a codebase:
1. Examine the tech stack to identify framework-level patterns
2. Look at directory structure for organizational patterns
3. Analyze exports for API design patterns
4. Check for common patterns: Effect-TS, reactive, functional, OOP
5. Identify state management, error handling, and configuration patterns

Provide a structured report covering:
- Primary architecture pattern
- State management approach
- Error handling strategy
- Configuration pattern
- Event/messaging patterns
- Data access patterns`,
    examples: [],
    constraints: [
      "Base conclusions on evidence from the code",
      "Note when patterns are mixed or inconsistent",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components", "protocol"],
  },

  // ====== APPLICATION / SERVICE SKILLS ======
  {
    name: "api-development",
    description: "Full lifecycle skill for developing HTTP APIs — from route creation to testing to documentation",
    level: "advanced",
    category: "development",
    toolPatterns: ["route-inspector", "dev-server-launcher", "build-runner", "test-runner", "lint-runner", "type-checker"],
    triggers: [
      "add a new endpoint",
      "create an API route",
      "implement endpoint",
      "add REST endpoint",
      "modify API",
      "fix endpoint",
      "test API routes",
    ],
    prompt: `You are an API development expert. When working on HTTP APIs in this codebase:

**Development Flow:**
1. Use route-inspector to understand existing endpoints
2. Follow the existing patterns for new route definitions
3. Ensure proper request/response typing
4. Add validation using Zod schemas (if present)
5. Use test-runner to verify the endpoint works
6. Run type-checker and lint-runner to ensure quality

**Conventions to follow:**
- Match the existing code style and patterns
- Use the framework's routing conventions (Hono/Express)
- Include error handling
- Add input validation
- Write tests for new endpoints

**Quality gates before completing:**
- All types pass (type-checker)
- Linting passes (lint-runner)
- Tests pass (test-runner)
- No breaking changes to existing routes`,
    examples: [
      {
        input: "Add a POST /users endpoint that creates a user",
        expectedOutput: "New route handler with input validation, error handling, tests, and type safety",
        description: "Standard API development task",
      },
    ],
    constraints: [
      "Never modify existing route signatures without explicit approval",
      "Always run type-checker after changes",
      "Maintain backward compatibility",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["application", "service"],
    applicableFrameworks: ["Hono", "Express"],
  },

  {
    name: "service-debugging",
    description: "Systematic debugging approach for service issues — from log analysis to root cause identification",
    level: "advanced",
    category: "debugging",
    toolPatterns: ["dev-server-launcher", "route-inspector", "dependency-analyzer"],
    triggers: [
      "service is broken",
      "debug this issue",
      "error in endpoint",
      "api not working",
      "server error",
      "500 error",
      "investigate bug",
    ],
    prompt: `You are a debugging specialist. When investigating service issues:

**Debugging Process:**
1. Reproduce: Identify the exact error and how to trigger it
2. Route check: Use route-inspector to verify the route exists
3. Dependency check: Use dependency-analyzer to check for version issues
4. Type check: Run type-checker to find type errors
5. Code analysis: Trace the request flow through handlers
6. Root cause: Identify the fundamental issue

**Report format:**
- Issue description
- Reproduction steps
- Root cause analysis
- Fix recommendation
- Prevention measures`,
    examples: [],
    constraints: [
      "Document all findings systematically",
      "Never apply fixes without understanding root cause",
      "Consider regression risks",
    ],
    prerequisiteTools: ["codebase-orientation", "pattern-detector"],
    applicableTypes: ["application", "service"],
  },

  // ====== LIBRARY / SDK SKILLS ======
  {
    name: "api-design",
    description: "Design and evolve public APIs with backward compatibility, proper typing, and documentation",
    level: "expert",
    category: "design",
    toolPatterns: ["public-api-explorer", "breaking-change-detector", "bundle-analyzer", "type-checker"],
    triggers: [
      "design new API",
      "add export",
      "evolve the API",
      "change public interface",
      "add function to library",
      "modify SDK interface",
    ],
    prompt: `You are an API design expert focused on library/SDK development.

**Design Principles:**
1. Consistency: Match existing naming conventions
2. Type safety: Full TypeScript types for all parameters and returns
3. Documentation: JSDoc on all public exports
4. Backward compatibility: Never break existing consumers
5. Minimal surface: Only export what's needed

**Development Flow:**
1. Use public-api-explorer to understand current API surface
2. Design the new addition following existing patterns
3. Use breaking-change-detector to verify no breakage
4. Use type-checker to verify type safety
5. Use bundle-analyzer to check size impact

**Quality standards:**
- All exports have JSDoc documentation
- All types are explicit (no 'any')
- Error types are specific and actionable
- Examples are provided for complex APIs`,
    examples: [
      {
        input: "Add a new utility function to the SDK",
        expectedOutput: "Fully typed, documented, tested function that follows existing API patterns",
        description: "API extension task",
      },
    ],
    constraints: [
      "Always check for breaking changes",
      "Document all public APIs",
      "Follow semantic versioning implications",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["library", "sdk"],
  },

  // ====== CLI SKILLS ======
  {
    name: "cli-development",
    description: "Develop CLI commands with proper argument parsing, help text, and error messages",
    level: "intermediate",
    category: "development",
    toolPatterns: ["command-explorer", "build-runner", "test-runner"],
    triggers: [
      "add a command",
      "create CLI command",
      "new subcommand",
      "add flag",
      "modify CLI",
    ],
    prompt: `You are a CLI development expert. When working on CLI commands:

**Development Flow:**
1. Use command-explorer to understand existing command structure
2. Follow the established patterns for command definition
3. Include proper help text and usage examples
4. Handle errors gracefully with actionable messages
5. Test the command with various inputs

**Standards:**
- Clear, concise help text
- Proper exit codes
- Structured error messages
- Support for --help on all commands
- Consistent naming conventions`,
    examples: [],
    constraints: [
      "Follow existing command patterns",
      "Always include --help support",
      "Use proper exit codes",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["cli"],
  },

  // ====== UI COMPONENT SKILLS ======
  {
    name: "component-development",
    description: "Develop UI components following design system patterns with proper props, accessibility, and testing",
    level: "intermediate",
    category: "development",
    toolPatterns: ["component-registry", "test-runner", "type-checker"],
    triggers: [
      "create a component",
      "add UI component",
      "new component",
      "modify component props",
      "component accessibility",
    ],
    prompt: `You are a UI component expert. When developing components:

**Development Flow:**
1. Use component-registry to understand existing component patterns
2. Follow the design system conventions
3. Define clear TypeScript props interface
4. Implement accessibility (ARIA) attributes
5. Write component tests
6. Run type-checker for type safety

**Standards:**
- Props should be typed with interfaces
- Default values for optional props
- Forward refs when appropriate
- Semantic HTML elements
- ARIA labels for accessibility
- Responsive by default`,
    examples: [],
    constraints: [
      "Follow design system conventions",
      "All components must be accessible",
      "Type all props explicitly",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["ui-components"],
  },

  // ====== PROTOCOL SKILLS ======
  {
    name: "protocol-development",
    description: "Develop and evolve API protocols with proper schema validation and client generation",
    level: "advanced",
    category: "development",
    toolPatterns: ["schema-validator", "symbol-finder", "type-checker"],
    triggers: [
      "add endpoint to protocol",
      "modify API schema",
      "update protocol",
      "new RPC method",
      "protocol validation",
    ],
    prompt: `You are a protocol design expert. When working on API protocols:

**Development Flow:**
1. Use schema-validator to check current schema consistency
2. Define new types/schemas following existing patterns
3. Use symbol-finder to understand current API surface
4. Run type-checker to verify type consistency
5. Verify both client and server implementations align

**Standards:**
- All types fully specified
- Backward compatible changes only
- Error types are comprehensive
- Version awareness for breaking changes`,
    examples: [],
    constraints: [
      "Maintain backward compatibility",
      "Validate all schema changes",
      "Keep client and server in sync",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["protocol"],
  },

  // ====== DOCUMENTATION SKILLS ======
  {
    name: "documentation-authoring",
    description: "Write and maintain documentation with proper structure, examples, and cross-references",
    level: "intermediate",
    category: "documentation",
    toolPatterns: ["content-analyzer"],
    triggers: [
      "write documentation",
      "add docs page",
      "update docs",
      "fix documentation",
      "add example",
    ],
    prompt: `You are a technical writer. When authoring documentation:

**Process:**
1. Use content-analyzer to understand existing docs structure
2. Follow the established documentation patterns
3. Include code examples for all APIs
4. Add cross-references to related pages
5. Ensure consistent terminology

**Standards:**
- Clear, concise prose
- Code examples are runnable
- Proper heading hierarchy
- Internal links between pages
- Up-to-date with actual code`,
    examples: [],
    constraints: [
      "Follow existing documentation patterns",
      "Include code examples",
      "Keep docs in sync with code",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["documentation"],
  },

  // ====== MONOREPO SKILLS ======
  {
    name: "cross-package-development",
    description: "Make changes that span multiple packages in the monorepo with proper dependency management",
    level: "expert",
    category: "development",
    toolPatterns: ["workspace-graph", "cross-package-search", "build-runner", "type-checker"],
    triggers: [
      "change across packages",
      "update shared dependency",
      "refactor across packages",
      "monorepo change",
      "update workspace dependency",
    ],
    prompt: `You are a monorepo architecture expert. When making cross-package changes:

**Process:**
1. Use workspace-graph to understand the dependency topology
2. Use cross-package-search to find all affected code
3. Plan changes in dependency order (leaves first)
4. Implement changes package by package
5. Run type-checker across all affected packages
6. Run build-runner to verify everything builds

**Standards:**
- Respect package boundaries
- Minimize coupling between packages
- Update all consumers of changed APIs
- Verify the full dependency chain builds`,
    examples: [],
    constraints: [
      "Always check workspace dependencies first",
      "Change leaf packages before their dependents",
      "Run full type-check after changes",
      "Verify no circular dependencies introduced",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["monorepo-root"],
  },

  // ====== EFFECT-TS SKILLS ======
  {
    name: "effect-ts-development",
    description: "Develop using Effect-TS patterns — proper use of Effect, Layer, Context, Error channels, and composability",
    level: "expert",
    category: "development",
    toolPatterns: ["symbol-finder", "pattern-detector", "type-checker"],
    triggers: [
      "effect-ts pattern",
      "use Effect",
      "Layer composition",
      "error handling with Effect",
      "effect-ts best practices",
    ],
    prompt: `You are an Effect-TS expert. When developing with Effect-TS:

**Patterns to use:**
- Effect for async computations with typed errors
- Layer for dependency injection
- Context for service definitions
- Ref for mutable state
- Either/Option for optional values

**Best practices:**
- Use Effect.gen with generators for readable async code
- Define errors as data types (case classes)
- Use Layer.merge for combining dependencies
- Provide all layers at the application boundary
- Use Effect.catchAll for error boundaries

**Anti-patterns to avoid:**
- Don't use Promise directly (wrap in Effect)
- Don't use throw/catch (use error channels)
- Don't mix Effect and non-Effect code at boundaries`,
    examples: [],
    constraints: [
      "Follow Effect-TS conventions strictly",
      "Use typed errors (never 'unknown')",
      "Provide all dependencies via Layer",
    ],
    prerequisiteTools: ["codebase-orientation", "pattern-detector"],
    applicableTypes: ["library", "application", "service", "core"],
    applicableFrameworks: ["Effect-TS"],
  },

  // ====== TESTING SKILLS ======
  {
    name: "test-driven-development",
    description: "Apply TDD methodology — write tests first, then implement, with proper coverage and edge case analysis",
    level: "advanced",
    category: "testing",
    toolPatterns: ["test-runner", "type-checker"],
    triggers: [
      "TDD approach",
      "write tests first",
      "test coverage",
      "add test cases",
      "edge case testing",
    ],
    prompt: `You are a TDD expert. When applying test-driven development:

**TDD Cycle:**
1. Red: Write a failing test for the new behavior
2. Green: Write the minimum code to make the test pass
3. Refactor: Clean up while keeping tests green

**Test Design:**
- Test behavior, not implementation
- Cover happy path, edge cases, and error cases
- Use descriptive test names
- Keep tests independent
- Use property-based testing where applicable (fast-check)

**Quality metrics:**
- All new code has tests
- Edge cases are covered
- No flaky tests
- Tests run in < 30 seconds`,
    examples: [],
    constraints: [
      "Write tests before implementation",
      "Cover all edge cases",
      "Keep tests fast and reliable",
    ],
    prerequisiteTools: ["codebase-orientation"],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components"],
  },

  // ====== BUILD & DEPLOY SKILLS ======
  {
    name: "ci-pipeline-management",
    description: "Manage and optimize CI/CD pipelines — type checking, linting, building, and testing",
    level: "intermediate",
    category: "build",
    toolPatterns: ["build-runner", "lint-runner", "type-checker", "test-runner"],
    triggers: [
      "run CI checks",
      "fix build",
      "type errors",
      "lint errors",
      "CI pipeline",
      "check all",
    ],
    prompt: `You are a CI/CD expert. When managing build pipelines:

**Check Sequence:**
1. type-checker: Fix all TypeScript errors first
2. lint-runner: Fix all linting issues
3. test-runner: Ensure all tests pass
4. build-runner: Verify production build works

**Troubleshooting:**
- Type errors: Check imports and type definitions
- Lint errors: Run with --fix first, then address manually
- Test failures: Check for environment or mock issues
- Build errors: Check bundler configuration

**Optimization:**
- Run checks in parallel where possible
- Cache dependencies between runs
- Use incremental builds`,
    examples: [],
    constraints: [
      "Fix type errors before lint errors",
      "Never skip the type checker",
      "Verify production build works",
    ],
    prerequisiteTools: [],
    applicableTypes: ["library", "application", "service", "cli", "sdk", "ui-components"],
  },
];

// ============================================================================
// Skill Generator Class
// ============================================================================

export class SkillGenerator {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
  }

  /**
   * Generate all applicable skills for a codebase.
   */
  generateSkills(
    index: CodebaseIndex,
    tools: ToolDefinition[],
    env: Environment
  ): SkillDefinition[] {
    const skills: SkillDefinition[] = [];
    const toolNames = new Set(tools.map((t) => t.name));

    for (const template of SKILL_TEMPLATES) {
      // Check applicability by type
      if (!template.applicableTypes.includes(index.type)) continue;

      // Check framework applicability
      if (template.applicableFrameworks && template.applicableFrameworks.length > 0) {
        const hasFramework = template.applicableFrameworks.some((f) =>
          index.techStack.framework.includes(f)
        );
        if (!hasFramework) continue;
      }

      // Map template tool patterns to actual tool IDs
      const skillTools: string[] = [];
      for (const pattern of template.toolPatterns) {
        const matchingTool = tools.find((t) => t.name === pattern);
        if (matchingTool) {
          skillTools.push(matchingTool.id);
        }
      }

      // Check prerequisites
      const hasPrereqs = template.prerequisiteTools.every((p) =>
        skills.some((s) => s.name === p) || SKILL_TEMPLATES.some((t) => t.name === p)
      );

      const skillId = generateId(`${index.id}-skill-${template.name}`);
      const skill: SkillDefinition = {
        id: skillId,
        name: template.name,
        description: this.customizeDescription(template, index),
        codebaseId: index.id,
        level: template.level,
        category: template.category,
        tools: skillTools,
        triggers: template.triggers,
        prompt: this.customizePrompt(template, index),
        examples: template.examples,
        constraints: template.constraints,
        prerequisites: template.prerequisiteTools,
      };

      skills.push(skill);
    }

    log.info(`Generated ${skills.length} skills for '${index.name}' (${index.type})`);
    return skills;
  }

  /**
   * Generate skills for all codebases.
   */
  generateAllSkills(
    indices: Map<string, CodebaseIndex>,
    allTools: Map<string, ToolDefinition[]>,
    environments: Map<string, Environment>
  ): Map<string, SkillDefinition[]> {
    const allSkills = new Map<string, SkillDefinition[]>();

    for (const [id, index] of indices) {
      const env = environments.get(`env-${id}`);
      const tools = allTools.get(id);
      if (!env || !tools) continue;

      const skills = this.generateSkills(index, tools, env);
      allSkills.set(id, skills);
    }

    return allSkills;
  }

  /**
   * Customize skill description for the specific codebase.
   */
  private customizeDescription(template: SkillTemplate, index: CodebaseIndex): string {
    let desc = template.description;
    if (index.techStack.framework.length > 0) {
      desc += ` Tailored for ${index.techStack.framework.join(", ")} in ${index.name}.`;
    }
    return desc;
  }

  /**
   * Customize skill prompt with codebase-specific context.
   */
  private customizePrompt(template: SkillTemplate, index: CodebaseIndex): string {
    let prompt = template.prompt;

    // Add codebase context header
    const context = `\n\n**Codebase Context:**
- Package: ${index.name} (${index.type})
- Architecture: ${index.patterns.architecturePattern}
- Frameworks: ${index.techStack.framework.join(", ") || "N/A"}
- Language: ${index.techStack.language}
- Testing: ${index.testCoverage.testFramework}

`;

    return context + prompt;
  }

  /**
   * Get a summary of skills generated for a codebase.
   */
  getSkillSummary(skills: SkillDefinition[]): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const skill of skills) {
      summary[skill.level] = (summary[skill.level] || 0) + 1;
    }
    return summary;
  }
}
