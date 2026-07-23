// Reported 2026-07-23 on Android Chrome (Pixel 10): fast speech produces
// runs like "the the the project" — confirmed via Robin's own description
// to be repetition *within* a single recognized word's own text, not across
// separate result segments (an earlier fix targeting exact-adjacent-segment
// duplicates, aimed at what desktop Chrome was doing, didn't touch this at
// all). Chrome's exact segmentation/endpointer behavior isn't publicly
// documented and clearly differs across platforms — this collapses any run
// of the same word repeated back-to-back in the assembled transcript,
// rather than trying to model why the recognizer produced it. Trade-off: a
// genuine back-to-back verbatim repeat ("very very good") would also get
// collapsed to one instance — accepted as rare next to the disruptive,
// frequent glitch this targets.
export function collapseRepeatedWords(text: string): string {
  // Whitespace is buffered, not appended immediately — otherwise dropping a
  // duplicate word still leaves its surrounding space(s) behind, doubling
  // up whitespace where a word used to be.
  const tokens = text.split(/(\s+)/);
  const result: string[] = [];
  let previousWord: string | null = null;
  let pendingWhitespace = "";
  for (const token of tokens) {
    if (token === "") continue;
    if (/^\s+$/.test(token)) {
      pendingWhitespace += token;
      continue;
    }
    const normalized = token.toLowerCase().replace(/[.,!?;:]+$/, "");
    if (normalized === previousWord) {
      pendingWhitespace = "";
      continue;
    }
    result.push(pendingWhitespace, token);
    pendingWhitespace = "";
    previousWord = normalized;
  }
  return result.join("");
}
