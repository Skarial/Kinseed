import type {
  AIEngine,
  AIEngineTrace,
  CandidateEvidenceItem,
  ExtractionInput,
  FormulationContext,
} from "../ports/ai-engine.js";
import type { Intention } from "../domain/intention.js";

const FIRST_TESTIMONY = "J’ai commencé à travailler à l’Atelier Nova en 2022.";
const CORRECTION = "Correction : je m’étais trompé. J’ai commencé en 2021, pas en 2022.";
const HISTORY_DENIAL = "Non, je ne t’ai jamais dit 2022. Tu inventes.";

export class FakeAIEngine implements AIEngine {
  readonly extractionInputs: ExtractionInput[] = [];
  readonly formulationInputs: { readonly intention: Intention; readonly context: FormulationContext }[] = [];
  private readonly traces: AIEngineTrace[] = [];
  resetCount = 0;
  private failNextFormulationRequest = false;

  resetConversationContext(): void {
    this.resetCount += 1;
  }

  failNextFormulation(): void {
    this.failNextFormulationRequest = true;
  }

  async extractEvidence(input: ExtractionInput): Promise<readonly CandidateEvidenceItem[]> {
    this.extractionInputs.push(input);
    this.traces.push({
      provider: "fake", model: "fake-g0a1", engineVersion: "fake-g0a1-v2",
      promptPolicyVersion: "fake-extraction-v2", operation: "extraction", turnId: input.turnId,
      suppliedStateIds: [input.eventId], usage: { inputTokens: null, outputTokens: null },
    });

    if (input.message === FIRST_TESTIMONY) {
      return [this.employmentStartYear(2022, FIRST_TESTIMONY)];
    }
    if (input.message === CORRECTION) {
      return [this.employmentStartYear(2021, "J’ai commencé en 2021")];
    }
    if (input.message === HISTORY_DENIAL) {
      return [
        {
          kind: "testimony",
          proposition: {
            subjectRef: "H-TEST-001",
            predicate: "denies_prior_employment_start_year_testimony",
            value: 2022,
            context: { organisation: "Atelier Nova" },
          },
          supportingExcerpt: "je ne t’ai jamais dit 2022",
          extractionConfidence: "high",
          extractorVersion: "fake-g0a1-v2",
        },
      ];
    }
    return [];
  }

  async formulate(input: {
    readonly turnId: string;
    readonly intention: Intention;
    readonly context: FormulationContext;
  }): Promise<string> {
    this.formulationInputs.push(input);
    this.traces.push({
      provider: "fake", model: "fake-g0a1", engineVersion: "fake-g0a1-v2",
      promptPolicyVersion: "fake-formulation-v1", operation: "formulation", turnId: input.turnId,
      suppliedStateIds: [
        `state-version:${input.context.stateVersion}`,
        ...input.context.beliefHistory.map((belief) => belief.id),
      ],
      usage: { inputTokens: null, outputTokens: null },
    });
    if (this.failNextFormulationRequest) {
      this.failNextFormulationRequest = false;
      throw new Error("FakeAIEngine formulation failure");
    }

    const { intention, context } = input;
    const currentYear = String(context.currentBelief?.value);
    const firstYear = String(context.beliefHistory[0]?.value);
    const turnYear = String(context.turnEvidence[0]?.value);

    switch (intention.kind) {
      case "acknowledge_correction":
        return `D’après ta correction, ${turnYear}.`;
      case "report_record_conflict":
        return `Dans mon historique, tu m’avais bien indiqué ${firstYear} au départ, puis tu as corrigé en ${currentYear}.`;
      case "answer_question":
        switch (intention.motivation) {
          case "record_first_testimony":
            return `Tu m’as indiqué ${turnYear}.`;
          case "recall_first_testimony":
            return `Tu m’avais dit ${firstYear}.`;
          case "report_current_belief":
            return `D’après ta correction, ${currentYear}.`;
          case "report_belief_history":
            return `Oui. Tu m’avais d’abord dit ${firstYear}, puis tu as corrigé en ${currentYear}.`;
          case "report_current_belief_with_provenance":
            return `Ma conclusion actuelle est ${currentYear}, d’après ta correction explicite ; tu avais auparavant indiqué ${firstYear}.`;
          default:
            return "Je n’ai pas de conclusion durable à ajouter.";
        }
    }
  }

  readTrace(): readonly AIEngineTrace[] {
    return [...this.traces];
  }

  private employmentStartYear(year: number, supportingExcerpt: string): CandidateEvidenceItem {
    return {
      kind: "testimony",
      proposition: {
        subjectRef: "H-TEST-001",
        predicate: "employment_start_year",
        value: year,
        context: { organisation: "Atelier Nova" },
      },
      supportingExcerpt,
      extractionConfidence: "high",
      extractorVersion: "fake-g0a1-v2",
    };
  }
}
