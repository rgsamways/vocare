import { anthropic } from "./anthropic-client.js";
import { CRISIS_CHECK_MODEL } from "../config.js";

/**
 * Deliberately narrow — see design.md's Decisions: a dedicated, small,
 * synchronous classification call, not folded into the conversational reply
 * and not a keyword blocklist. Few-shot examples are tuned toward the spec's
 * explicit intent (explicit self-harm/acute-crisis language only), not
 * broad distress — ordinary career-stress venting must never trigger this.
 * Thresholds and phrasing are placeholders pending professional review.
 */
const CRISIS_CHECK_SYSTEM_PROMPT = `You are a narrow safety classifier for a career-practice conversation app. Your only job is to detect EXPLICIT self-harm or acute-crisis language in the message below — not general stress, frustration, burnout, sadness, or hyperbole about work.

Set crisis_detected to true only when the message explicitly expresses suicidal ideation, intent to self-harm, or being in immediate danger.

Set crisis_detected to false for ordinary career stress, venting, or hyperbolic language about work, even when strongly worded or clearly unhappy — this classifier is intentionally narrow and must not trigger on general distress that is not explicit.

Examples that must NOT trigger (crisis_detected: false):
- "This job is literally killing me."
- "I feel like I'm drowning in deadlines, I just want to disappear for a week."
- "I'm so burned out I could scream."
- "Sometimes I think about quitting and never working again."
- "Honestly my life feels like a mess right now because of work."

Examples that MUST trigger (crisis_detected: true):
- "I don't want to be alive anymore."
- "I've been thinking about ending things."
- "I have a plan to hurt myself tonight."
- "I don't see the point in going on."

Respond with structured output only.`;

const CRISIS_SCHEMA = {
  type: "object",
  properties: {
    crisis_detected: { type: "boolean" },
  },
  required: ["crisis_detected"],
  additionalProperties: false,
} as const;

/**
 * Runs synchronously against every user turn, before/alongside the
 * conversational reply, so the safety card can appear inline immediately —
 * see design.md. On any error parsing the model's structured output, fails
 * toward false (no trigger): a parse failure is an infra fault, not a
 * content signal, and this classifier's job is narrow detection, not a
 * general safety net for outages.
 */
export async function checkCrisisLanguage(turnContent: string): Promise<boolean> {
  const response = await anthropic.messages.create({
    model: CRISIS_CHECK_MODEL,
    max_tokens: 32,
    system: CRISIS_CHECK_SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: CRISIS_SCHEMA } },
    messages: [{ role: "user", content: turnContent }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") return false;

  try {
    const parsed = JSON.parse(textBlock.text) as { crisis_detected: boolean };
    return parsed.crisis_detected === true;
  } catch {
    return false;
  }
}
