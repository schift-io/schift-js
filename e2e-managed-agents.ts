/**
 * E2E: Managed Agents API — full lifecycle test.
 *
 * Usage: npx tsx e2e-managed-agents.ts
 */
import { Schift } from "./src/index.js";

const API_KEY = process.env.SCHIFT_API_KEY;
if (!API_KEY) {
  console.error("SCHIFT_API_KEY is required");
  process.exit(1);
}

const schift = new Schift({
  apiKey: API_KEY,
  baseUrl: "https://api.schift.io",
});

async function main() {
  console.log("=== Managed Agents E2E ===\n");

  // 1. Create agent
  console.log("1. Creating agent...");
  const agent = await schift.agents.create({
    name: `e2e-${Date.now()}`,
    model: "gemini-2.5-flash-lite",
    instructions: "You are a helpful assistant. Keep answers under 2 sentences.",
  });
  console.log(`   Agent created: ${agent.id}`);
  console.log(`   Name: ${agent.name}`);
  console.log(`   Model: ${agent.model}`);
  console.log();

  // 2. List agents
  console.log("2. Listing agents...");
  const agents = await schift.agents.list();
  console.log(`   Found ${agents.length} agent(s)`);
  console.log();

  // 3. Get agent
  console.log("3. Getting agent...");
  const fetched = await schift.agents.get(agent.id);
  console.log(`   Name: ${fetched.name}`);
  console.log(`   Instructions: ${fetched.instructions.substring(0, 60)}...`);
  console.log();

  // 4. Update agent
  console.log("4. Updating agent...");
  const updated = await schift.agents.update(agent.id, {
    instructions: "You are a pirate assistant. Answer in pirate speak. Keep it short.",
  });
  console.log(`   Updated instructions: ${updated.instructions.substring(0, 60)}...`);
  console.log();

  // 5. Start a run
  console.log("5. Starting run...");
  const runs = schift.agents.runs(agent.id);
  const run = await runs.create({ message: "What is the meaning of life?" });
  console.log(`   Run created: ${run.id}`);
  console.log(`   Status: ${run.status}`);
  console.log();

  // 6. Poll until complete
  console.log("6. Waiting for completion...");
  let result = run;
  const start = Date.now();
  while (result.status === "pending" || result.status === "running") {
    await new Promise((r) => setTimeout(r, 1000));
    result = await runs.get(run.id);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`\r   Status: ${result.status} (${elapsed}s)`);
  }
  console.log();
  console.log(`   Final status: ${result.status}`);
  console.log(`   Tokens: ${result.tokensUsed}`);
  console.log(`   Duration: ${result.durationMs}ms`);
  console.log(`   Output: ${result.outputText}`);
  console.log();

  // 7. Replay events
  console.log("7. Replaying events...");
  for await (const event of runs.streamEvents(run.id)) {
    console.log(`   [seq=${event.seq}] ${event.eventType}: ${JSON.stringify(event).substring(0, 100)}`);
  }
  console.log();

  // 8. List runs
  console.log("8. Listing runs...");
  const allRuns = await runs.list();
  console.log(`   Found ${allRuns.length} run(s)`);
  console.log();

  // 9. Delete agent
  console.log("9. Deleting agent...");
  await schift.agents.delete(agent.id);
  console.log("   Deleted.");
  console.log();

  // 10. Verify deletion
  console.log("10. Verifying deletion...");
  try {
    await schift.agents.get(agent.id);
    console.log("   ERROR: Agent still exists!");
  } catch (e: any) {
    console.log(`   Confirmed: ${e.message || "Agent not found"}`);
  }
  console.log();

  console.log("=== E2E Complete ===");
}

main().catch((e) => {
  console.error("E2E FAILED:", e);
  process.exit(1);
});
