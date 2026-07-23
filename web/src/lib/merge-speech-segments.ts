// Reported 2026-07-23 on Android Chrome (Pixel 10) and confirmed via Robin's
// own exact repro: "I'm I'm going I'm going to I'm going to say I'm going to
// say the...". Each entry in SpeechRecognition's event.results isn't a new,
// distinct segment on this device — it's a cumulative restatement of the
// whole utterance so far (entry N already contains everything entry N-1
// contained, plus the next word). The naive fix (concatenate every entry)
// duplicates all of that shared history every time a new entry arrives,
// which is what produced the "exponential"-feeling growth. This collapses a
// chain of entries where each one is a prefix-extension of the last down to
// just the final, most complete entry in that chain — while still
// concatenating genuinely distinct segments (e.g. across a pause, where a
// new utterance doesn't restate the previous one) the way desktop Chrome's
// actual incremental segments need to be.
export function mergeSpeechSegments(segments: string[]): string {
  const committed: string[] = [];
  for (const segment of segments) {
    const last = committed[committed.length - 1];
    if (last !== undefined && segment.startsWith(last)) {
      committed[committed.length - 1] = segment;
    } else {
      committed.push(segment);
    }
  }
  return committed.join("");
}
