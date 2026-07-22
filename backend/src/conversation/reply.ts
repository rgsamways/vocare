import { anthropic } from "./anthropic-client.js";
import { CONVERSATION_MODEL, type PersonaCombination } from "../config.js";
import { buildConversationalSystemPrompt, type AnchorSteering } from "./system-prompt.js";

export interface TranscriptTurnInput {
  speaker: "user" | "assistant";
  content: string;
}

export interface GenerateReplyParams {
  persona: PersonaCombination;
  anchor?: AnchorSteering;
  /** Full turn history for the session, ending with the latest user turn. */
  history: TranscriptTurnInput[];
}

export interface GenerateReplyResult {
  text: string;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

/**
 * The system prompt is identical for every turn in a session (persona is
 * fixed at session start, anchor steering never changes), so the
 * cache_control breakpoint here is a real cache boundary across turns 2+ —
 * see design.md's caching Decisions. Rolling conversation history is not
 * cached, since it differs on every call by definition.
 */
export async function generateConversationalReply(
  params: GenerateReplyParams,
): Promise<GenerateReplyResult> {
  const systemPrompt = buildConversationalSystemPrompt(params.persona, params.anchor);

  const response = await anthropic.messages.create({
    model: CONVERSATION_MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: params.history.map((turn) => ({ role: turn.speaker, content: turn.content })),
  });

  const textBlock = response.content.find((block) => block.type === "text");

  return {
    text: textBlock && textBlock.type === "text" ? textBlock.text : "",
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: response.usage.cache_creation_input_tokens ?? 0,
  };
}
