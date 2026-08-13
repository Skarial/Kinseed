import OpenAI from "openai";

import {
  buildG0A2C0Report,
  buildG0A2C0Request,
  measureG0A2C0Pair,
  parseG0A2C0Decision,
  readG0A2C0RunCount,
  usageFromResponse,
} from "./g0a2-c0-runner-lib.mjs";

async function main() {
  const apiKey = requiredEnvironment("OPENAI_API_KEY");
  const model = requiredEnvironment("OPENAI_MODEL");
  const pairCount = readG0A2C0RunCount(process.env.G0A2_C0_RUNS);
  const client = new OpenAI({ apiKey, maxRetries: 0 });
  const request = buildG0A2C0Request(model);
  const pairs = [];
  let successfulCallCount = 0;

  try {
    for (let pair = 1; pair <= pairCount; pair += 1) {
      const responseA = await client.responses.create(request);
      successfulCallCount += 1;
      const decisionA = parseG0A2C0Decision(responseA.output_text);
      const responseB = await client.responses.create(request);
      successfulCallCount += 1;
      const decisionB = parseG0A2C0Decision(responseB.output_text);
      pairs.push({
        pair,
        ...measureG0A2C0Pair(decisionA, decisionB),
        usage: { a: usageFromResponse(responseA), b: usageFromResponse(responseB) },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`G0-A2 C0 failed after ${successfulCallCount} successful calls: ${message}`);
  }

  console.log(JSON.stringify(buildG0A2C0Report({
    executedAt: new Date().toISOString(), model, pairs,
  }), null, 2));
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "G0-A2 C0 failed");
  process.exitCode = 1;
});
