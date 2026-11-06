# Codebase Harness System

A comprehensive harness engineering system that creates **isolated environments** for each codebase within a monorepo, **indexes** them deeply, and generates **codebase-specific tools and skills** tailored to each package's type, architecture, and technology stack.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HARNESS ENGINE                                │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │   CODEBASE    │──▶│  ENVIRONMENT │──▶│      TOOL GENERATOR      │ │
│  │   INDEXER     │   │   MANAGER    │   │                          │ │
│  │              │   │              │   │  • navigation tools        │ │
│  │ • discovery  │   │ • isolation  │   │  • analysis tools          │ │
│  │ • indexing   │   │ • resources  │   │  • search tools            │ │
│  │ • classify   │   │ • network    │   │  • build tools             │ │
│  │ • patterns   │   │ • filesystem │   │  • testing tools           │ │
│  │ • metrics    │   │ • policies   │   │  • validation tools        │ │
│  └──────────────┘   └──────────────┘   └──────────────────────────┘ │
│           │                   │                        │              │
│           ▼                   ▼                        ▼              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    SKILL GENERATOR                             │   │
│  │  • codebase-orientation  • api-development  • TDD             │   │
│  │  • pattern-detector     • service-debugging • CI pipeline     │   │
│  │  • api-design           • component-dev    • cross-package    │   │
│  │  • documentation        • protocol-dev     • Effect-TS dev    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                        │
│                              ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       REGISTRY                                 │   │
│  │  Central registry of all codebases, environments, tools,      │   │
│  │  and skills with querying, lookup, and reporting.             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Codebase Indexing

Each codebase is deeply analyzed to extract:

| Aspect | Details |
|--------|---------|
| **Type** | library, application, service, cli, sdk, ui-components, protocol, documentation, infrastructure, monorepo-root |
| **Tech Stack** | Languages, frameworks, build tools, testing frameworks, linters, bundlers |
| **Architecture** | Effect-TS, reactive, functional, OOP patterns |
| **Dependencies** | Categorized (core, ui, testing, build, dev, runtime, ai, database, network) |
| **Metrics** | File counts, line counts, exports, test coverage |
| **Patterns** | State management, API patterns, error handling, events, database |

### 2. Isolated Environments

Each codebase gets its own environment with:

- **Isolated workspace directory** with separate cache, logs, temp, and output dirs
- **Scoped environment variables** (HARNESS_ENV_ID, HARNESS_WORK_DIR, etc.)
- **Resource limits** tailored to codebase type (memory, CPU, disk, processes)
- **Network policies** (allowed hosts, blocked ports, outbound control)
- **File access policies** (read/write paths, deny paths)
- **Command allowlists/denylists** for security
- **Activation scripts** for easy environment setup

### 3. Codebase-Specific Tools

Tools are generated based on the codebase type and tech stack:

| Codebase Type | Tools Generated |
|---------------|----------------|
| **Library/SDK** | file-explorer, codebase-summary, dependency-analyzer, symbol-finder, public-api-explorer, breaking-change-detector, bundle-analyzer, test-runner, lint-runner, type-checker |
| **Application/Service** | file-explorer, codebase-summary, dependency-analyzer, symbol-finder, route-inspector, dev-server-launcher, build-runner, test-runner, lint-runner, type-checker |
| **CLI** | file-explorer, codebase-summary, dependency-analyzer, symbol-finder, command-explorer, build-runner, test-runner, lint-runner |
| **UI Components** | file-explorer, codebase-summary, dependency-analyzer, symbol-finder, component-registry, build-runner, test-runner, lint-runner, type-checker |
| **Protocol** | file-explorer, codebase-summary, dependency-analyzer, symbol-finder, schema-validator |
| **Documentation** | file-explorer, codebase-summary, dependency-analyzer, content-analyzer |
| **Monorepo Root** | file-explorer, codebase-summary, dependency-analyzer, workspace-graph, cross-package-search |

### 4. Codebase-Specific Skills

Skills are higher-level capabilities that orchestrate multiple tools:

| Skill | Level | Applicable Types |
|-------|-------|-----------------|
| codebase-orientation | basic | All |
| pattern-detector | intermediate | Most |
| api-development | advanced | Application, Service |
| service-debugging | advanced | Application, Service |
| api-design | expert | Library, SDK |
| cli-development | intermediate | CLI |
| component-development | intermediate | UI Components |
| protocol-development | advanced | Protocol |
| documentation-authoring | intermediate | Documentation |
| cross-package-development | expert | Monorepo Root |
| effect-ts-development | expert | Effect-TS codebases |
| test-driven-development | advanced | Most |
| ci-pipeline-management | intermediate | Most |

Each skill includes:
- **Trigger patterns** — when to activate the skill
- **System prompt** — enhanced AI agent instructions with codebase context
- **Example I/O** — usage demonstrations
- **Constraints** — safety rules and quality gates
- **Prerequisites** — required lower-level skills

## Usage

```bash
# Run the harness
npx tsx harness/src/run.ts

# Output files
# .harness/output/harness-report.txt  — Human-readable report
# .harness/output/harness-state.json  — Machine-readable state
```

## Programmatic API

```typescript
import { HarnessEngine } from "./harness/src/engine";

const harness = new HarnessEngine({
  rootPath: "/path/to/monorepo",
  defaultIsolationLevel: "filesystem",
  maxConcurrentEnvironments: 10,
  logLevel: "info",
});

// Initialize (full pipeline)
const result = await harness.initialize();

// Access components
const registry = harness.getRegistry();
const indices = harness.getIndices();
const environments = harness.getEnvironments();

// Query tools and skills
const tools = harness.getTools(codebaseId);
const skills = harness.getSkills(codebaseId);

// Generate reports
const report = harness.generateReport();
const json = harness.exportJSON();

// Refresh a specific codebase
await harness.refresh(codebaseId);

// Listen for events
harness.onEvent((event) => {
  console.log(event.type, event);
});
```

## Results from this Monorepo

When run against the OpenCode monorepo:

- **42 codebases** discovered and indexed
- **42 isolated environments** created
- **403 tools** generated across all codebases
- **217 skills** generated across all codebases
- Initialization completes in ~1.6 seconds

## File Structure

```
harness/
├── src/
│   ├── types/
│   │   └── index.ts          # Core type definitions
│   ├── utils/
│   │   └── index.ts          # Shared utilities
│   ├── indexer/
│   │   └── codebase-indexer.ts  # Codebase discovery & analysis
│   ├── environment/
│   │   └── environment-manager.ts  # Isolated environment creation
│   ├── tools/
│   │   └── tool-generator.ts  # Codebase-specific tool generation
│   ├── skills/
│   │   └── skill-generator.ts  # Codebase-specific skill generation
│   ├── registry/
│   │   └── index.ts           # Central registry
│   ├── engine.ts              # Main orchestrator
│   ├── index.ts               # Public API exports
│   └── run.ts                 # Runner script
├── package.json
└── tsconfig.json
```
