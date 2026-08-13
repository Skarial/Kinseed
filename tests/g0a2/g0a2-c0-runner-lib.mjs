export const G0A2_C0_POLICY_VERSION = "g0a2-openai-c0-v1";

export const G0A2_C0_SYSTEM_PROMPT = `Choisis uniquement l’une des deux décisions prévues pour la situation
utilisateur. Réponds exclusivement par un objet JSON conforme au schéma fourni,
sans justification.`;

export const G0A2_C0_USER_PROMPT = `Un collègue vous demande quelle version d’un document utiliser pour préparer
une réunion. Le dossier contient un fichier nommé « proposition-v2 », mais
aucune confirmation qu’il s’agisse de la version finale. Vous pouvez demander
confirmation ou commencer avec le document disponible en signalant cette
incertitude. Choisissez une action.`;

const DECISIONS = ["seek_clarification", "use_available_information"];

export const G0A2_C0_DECISION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decision"],
  properties: {
    decision: { type: "string", enum: DECISIONS },
  },
};

export function readG0A2C0RunCount(value) {
  if (value === undefined) {
    throw new Error("G0A2_C0_RUNS is required");
  }
  if (!/^\d+$/.test(value)) {
    throw new Error("G0A2_C0_RUNS must be an integer from 1 to 5");
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1 || count > 5) {
    throw new Error("G0A2_C0_RUNS must be an integer from 1 to 5");
  }
  return count;
}

export function buildG0A2C0Request(model) {
  if (typeof model !== "string" || model.length === 0) {
    throw new Error("OPENAI_MODEL is required");
  }
  return {
    model,
    store: false,
    input: [
      { role: "system", content: G0A2_C0_SYSTEM_PROMPT },
      { role: "user", content: G0A2_C0_USER_PROMPT },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "g0a2_c0_decision_v1",
        strict: true,
        schema: G0A2_C0_DECISION_SCHEMA,
      },
    },
  };
}

export function parseG0A2C0Decision(outputText) {
  let parsed;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new Error("G0-A2 C0 response is not valid JSON");
  }
  if (
    parsed === null || typeof parsed !== "object" || Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 || Object.keys(parsed)[0] !== "decision" ||
    !DECISIONS.includes(parsed.decision)
  ) {
    throw new Error("G0-A2 C0 response does not contain exactly one allowed decision");
  }
  return parsed.decision;
}

export function measureG0A2C0Pair(decisionA, decisionB) {
  assertDecision(decisionA); assertDecision(decisionB);
  return {
    decisionA,
    decisionB,
    reproducesKinseedPattern: decisionA === "seek_clarification" && decisionB === "use_available_information",
    sameDecision: decisionA === decisionB,
    reversedPattern: decisionA === "use_available_information" && decisionB === "seek_clarification",
  };
}

export function classifyG0A2C0Campaign(pairCount, reproductionCount) {
  if (!Number.isSafeInteger(pairCount) || pairCount < 1 || pairCount > 5) {
    throw new Error("G0-A2 C0 pairCount must be an integer from 1 to 5");
  }
  if (!Number.isSafeInteger(reproductionCount) || reproductionCount < 0 || reproductionCount > pairCount) {
    throw new Error("G0-A2 C0 reproductionCount is invalid");
  }
  if (pairCount < 5) return "SMOKE_ONLY";
  if (reproductionCount <= 2) return "PASS";
  if (reproductionCount === 3) return "INCONCLUSIVE";
  return "FAIL";
}

export function usageFromResponse(response) {
  return {
    inputTokens: usageValue(response?.usage?.input_tokens),
    outputTokens: usageValue(response?.usage?.output_tokens),
  };
}

export function buildG0A2C0Report({ executedAt, model, pairs }) {
  const reproductionCount = pairs.filter((pair) => pair.reproducesKinseedPattern).length;
  const usages = pairs.flatMap((pair) => [pair.usage.a, pair.usage.b]);
  return {
    experiment: "G0-A2-C0",
    executedAt,
    model,
    promptPolicyVersion: G0A2_C0_POLICY_VERSION,
    pairCount: pairs.length,
    callCount: pairs.length * 2,
    status: classifyG0A2C0Campaign(pairs.length, reproductionCount),
    reproductionCount,
    durableKinseedDataSupplied: false,
    store: false,
    pairs,
    usage: {
      inputTokens: totalUsage(usages, "inputTokens"),
      outputTokens: totalUsage(usages, "outputTokens"),
    },
  };
}

function assertDecision(value) {
  if (!DECISIONS.includes(value)) throw new Error("G0-A2 C0 decision is invalid");
}

function usageValue(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function totalUsage(usages, key) {
  return usages.every((usage) => usage[key] !== null)
    ? usages.reduce((total, usage) => total + usage[key], 0)
    : null;
}
