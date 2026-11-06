#!/usr/bin/env node
/**
 * Codebase Harness - Runner Script
 *
 * Executes the full harness pipeline against the monorepo and generates
 * a comprehensive report showing the isolated environments, tools, and skills
 * generated for each codebase.
 *
 * Usage:
 *   npx tsx harness/src/run.ts
 */

import { HarnessEngine } from "./engine";
import { join, dirname } from "path";
import { writeFile, mkdir } from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_PATH = join(__dirname, "..", "..");
const OUTPUT_DIR = join(ROOT_PATH, ".harness", "output");

async function main() {
  console.log("\n🚀 Starting Codebase Harness System...\n");

  // Create the harness engine
  const harness = new HarnessEngine({
    rootPath: ROOT_PATH,
    defaultIsolationLevel: "filesystem",
    maxConcurrentEnvironments: 10,
    autoIndexOnStartup: true,
    logLevel: "info",
  });

  // Listen for events
  harness.onEvent((event) => {
    switch (event.type) {
      case "codebase-indexed":
        // Silent — already logged by indexer
        break;
      case "environment-created":
        console.log(`  🔧 Environment created: ${event.environmentId}`);
        break;
      case "environment-ready":
        console.log(`  ✅ Environment ready: ${event.environmentId}`);
        break;
      case "tools-generated":
        console.log(`  🛠️  ${event.count} tools generated for ${event.environmentId}`);
        break;
      case "skills-generated":
        console.log(`  🎯 ${event.count} skills generated for ${event.environmentId}`);
        break;
      case "environment-error":
        console.error(`  ❌ Environment error: ${event.environmentId} — ${event.error}`);
        break;
    }
  });

  // Initialize the harness (full pipeline)
  const result = await harness.initialize();

  // Generate and display the report
  const report = harness.generateReport();
  console.log(report);

  // Export JSON
  const jsonExport = harness.exportJSON();

  // Write outputs
  await mkdir(OUTPUT_DIR, { recursive: true });

  const reportPath = join(OUTPUT_DIR, "harness-report.txt");
  await writeFile(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  const jsonPath = join(OUTPUT_DIR, "harness-state.json");
  await writeFile(jsonPath, JSON.stringify(jsonExport, null, 2));
  console.log(`📊 JSON state saved to: ${jsonPath}`);

  // Print summary
  console.log("\n" + "═".repeat(70));
  console.log("  HARNESS INITIALIZATION SUMMARY");
  console.log("═".repeat(70));
  console.log(`  Codebases indexed:     ${result.codebaseCount}`);
  console.log(`  Environments created:  ${result.environmentCount}`);
  console.log(`  Tools generated:       ${result.toolCount}`);
  console.log(`  Skills generated:      ${result.skillCount}`);
  console.log(`  Time elapsed:          ${result.elapsedMs}ms`);
  console.log("═".repeat(70));

  // Show per-codebase summary table
  console.log("\n  CODEBASE → TOOLS → SKILLS MAPPING");
  console.log("─".repeat(70));
  console.log(
    "  " +
    "Codebase".padEnd(35) +
    "Type".padEnd(15) +
    "Tools".padEnd(8) +
    "Skills".padEnd(8) +
    "Isolation"
  );
  console.log("─".repeat(70));

  const registry = harness.getRegistry();
  for (const entry of registry.getAll()) {
    const index = harness.getIndex(entry.codebaseId);
    if (!index) continue;

    const name = entry.codebaseName.length > 33
      ? entry.codebaseName.substring(0, 30) + "..."
      : entry.codebaseName;
    console.log(
      "  " +
      name.padEnd(35) +
      index.type.padEnd(15) +
      String(entry.tools.length).padEnd(8) +
      String(entry.skills.length).padEnd(8) +
      entry.environment.config.isolationLevel
    );
  }

  console.log("─".repeat(70));

  // Show tool distribution
  const stats = registry.getStats();
  console.log("\n  TOOL DISTRIBUTION BY CATEGORY");
  console.log("─".repeat(40));
  for (const [cat, count] of Object.entries(stats.toolCategories).sort((a, b) => b[1] - a[1])) {
    const bar = "█".repeat(Math.min(count, 30));
    console.log(`  ${cat.padEnd(18)} ${String(count).padStart(3)} ${bar}`);
  }
  console.log("─".repeat(40));

  // Show skill distribution
  console.log("\n  SKILL DISTRIBUTION BY LEVEL");
  console.log("─".repeat(40));
  for (const [level, count] of Object.entries(stats.skillLevels)) {
    const bar = "█".repeat(Math.min(count * 2, 30));
    console.log(`  ${level.padEnd(18)} ${String(count).padStart(3)} ${bar}`);
  }
  console.log("─".repeat(40));
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
