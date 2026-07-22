/**
 * The redirect control's own invocation is persisted to transcript_turns as
 * a speaker:"user" row carrying this exact marker, rather than a new speaker
 * enum value — see schema.ts's transcriptTurns comment and design.md's
 * Decisions section ("stored as a user-style control-turn"). The main
 * conversational system prompt (system-prompt.ts) already instructs the
 * model to pivot gracefully whenever the latest user turn is a topic-change
 * request, so sending this literal turn through the normal history is enough
 * to produce the pivot — no separate mid-conversation system message needed.
 */
export const REDIRECT_TURN_CONTENT = "Let's talk about something else.";
