import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Resolves ANTHROPIC_API_KEY from the environment automatically — see
 * m2-conversation-engine/tasks.md 3.1. No custom request/response types on
 * top of the SDK's own; callers use Anthropic.Messages types directly.
 */
export const anthropic = new Anthropic();
