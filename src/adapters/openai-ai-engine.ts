import OpenAI from "openai";

import type { Intention } from "../domain/intention.js";
import type { TurnId } from "../domain/primitives.js";
import type {
  AIEngine,
  AIEngineTrace,
  CandidateEvidenceItem,
  ExtractionInput,
  FormulationContext,
} from "../ports/ai-engine.js";

const DEFAULT_EXPERIMENTAL_MODEL = "gpt-5.6-luna";
const ENGINE_VERSION = "openai-g0a1-v2";
const EXTRACTION_POLICY_VERSION = "g0a1-openai-extraction-v3";
const FORMULATION_POLICY_VERSION = "g0a1-openai-formulation-v1";
const CONTROL_POLICY_VERSION = "g0a1-openai-control-v1";

const evidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      minItems: 0,
      maxItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "subjectRef", "predicate", "value", "organisation", "supportingExcerpt"],
        properties: {
          kind: { type: "string", enum: ["testimony"] },
          subjectRef: { type: "string", enum: ["H-TEST-001"] },
          predicate: {
            type: "string",
            description:
              "For a factual correction 'X, not Y', use employment_start_year only for X; Y is the corrected value, not a historical denial. Use denies_prior_employment_start_year_testimony only when the message explicitly denies having said, declared, or indicated Y previously.",
            enum: ["employment_start_year", "denies_prior_employment_start_year_testimony"],
          },
          value: { type: "integer" },
          organisation: { type: "string", enum: ["Atelier Nova"] },
          supportingExcerpt: { type: "string" },
        },
      },
    },
  },
} as const;

interface OpenAIAIEngineOptions {
  readonly apiKey?: string;
  readonly model?: string;
}

export class OpenAIAIEngine implements AIEngine {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly traces: AIEngineTrace[] = [];

  constructor(options: OpenAIAIEngineOptions = {}) {
    const apiKey = options.apiKey ?? environmentValue("OPENAI_API_KEY");
    if (apiKey === undefined || apiKey.length === 0) {
      throw new Error("OPENAI_API_KEY is required to use OpenAIAIEngine");
    }
    this.client = new OpenAI({ apiKey });
    this.model = options.model ?? environmentValue("OPENAI_MODEL") ?? DEFAULT_EXPERIMENTAL_MODEL;
  }

  async extractEvidence(input: ExtractionInput): Promise<readonly CandidateEvidenceItem[]> {
    const response = await this.client.responses.create({
      model: this.model,
      store: false,
      input: [
        {
          role: "system",
          content:
            "Extract only G0-A1 testimony candidates from the current human message. Return no candidate for unrelated questions. Return at most one candidate. supportingExcerpt must be an exact verbatim substring of the current message, never a paraphrase, and must contain the extracted value. For a factual correction such as 'I started in 2021, not 2022', return only employment_start_year = 2021: 2022 is the corrected value, not a denial of historical testimony. Use denies_prior_employment_start_year_testimony = Y only when the message explicitly denies having said, declared, or indicated Y previously. Never infer personality, preference, emotion, value, loyalty, or any psychological trait.",
        },
        {
          role: "user",
          content: JSON.stringify({ message: input.message, subjectRef: "H-TEST-001" }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "g0a1_evidence_candidates",
          strict: true,
          schema: evidenceSchema,
        },
      },
    });
    this.recordTrace("extraction", input.turnId, [input.eventId], EXTRACTION_POLICY_VERSION, response);
    return parseCandidates(response.output_text);
  }

  async formulate(input: {
    readonly turnId: TurnId;
    readonly intention: Intention;
    readonly context: FormulationContext;
  }): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      store: false,
      input: [
        {
          role: "system",
          content:
            "Formulate a concise French response constrained by the supplied LenoSeed intention and structured evidence. Do not invent facts or psychological claims. Do not claim certainty beyond testimony and provenance.",
        },
        {
          role: "user",
          content: JSON.stringify({ intention: input.intention, context: input.context }),
        },
      ],
    });
    this.recordTrace(
      "formulation",
      input.turnId,
      [
        `state-version:${input.context.stateVersion}`,
        ...input.context.beliefHistory.map((belief) => belief.id),
      ],
      FORMULATION_POLICY_VERSION,
      response,
    );
    return response.output_text;
  }

  async runControlQuestion(turnId: TurnId, question: string): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      store: false,
      input: [
        {
          role: "system",
          content:
            "Answer only from the current question. You have no conversation history and no LenoSeed state. If the question requires prior facts, state that you do not know them.",
        },
        { role: "user", content: question },
      ],
    });
    this.recordTrace("control", turnId, [], CONTROL_POLICY_VERSION, response);
    return response.output_text;
  }

  readTrace(): readonly AIEngineTrace[] {
    return [...this.traces];
  }

  private recordTrace(
    operation: AIEngineTrace["operation"],
    turnId: TurnId,
    suppliedStateIds: readonly string[],
    promptPolicyVersion: string,
    response: { readonly usage?: { readonly input_tokens: number; readonly output_tokens: number } | null },
  ): void {
    this.traces.push({
      provider: "openai",
      model: this.model,
      engineVersion: ENGINE_VERSION,
      promptPolicyVersion,
      operation,
      turnId,
      suppliedStateIds,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
      },
    });
  }
}

function parseCandidates(outputText: string): readonly CandidateEvidenceItem[] {
  const parsed = JSON.parse(outputText) as {
    candidates: readonly {
      kind: "testimony";
      subjectRef: "H-TEST-001";
      predicate: "employment_start_year" | "denies_prior_employment_start_year_testimony";
      value: number;
      organisation: "Atelier Nova";
      supportingExcerpt: string;
    }[];
  };
  return parsed.candidates.map((candidate) => ({
    kind: candidate.kind,
    proposition: {
      subjectRef: candidate.subjectRef,
      predicate: candidate.predicate,
      value: candidate.value,
      context: { organisation: candidate.organisation },
    },
    supportingExcerpt: candidate.supportingExcerpt,
    extractionConfidence: "medium",
    extractorVersion: ENGINE_VERSION,
  }));
}

function environmentValue(name: string): string | undefined {
  const runtime = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return runtime.process?.env?.[name];
}
