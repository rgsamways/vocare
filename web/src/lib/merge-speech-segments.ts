// Reported 2026-07-23 on Android Chrome (Pixel 10) and confirmed via Robin's
// own exact repro: "I'm I'm going I'm going to I'm going to say I'm going to
// say the...". Each entry in SpeechRecognition's event.results isn't a new,
// distinct segment on this device — it's a cumulative restatement of the
// whole utterance so far (entry N already contains everything entry N-1
// contained, plus the next word). The naive fix (concatenate every entry)
// duplicates all of that shared history every time a new entry arrives,
// which is what produced the "exponential"-feeling growth. This collapses a
// chain of entries where each one is a strictly-longer prefix-extension of
// the last down to just the final, most complete entry in that chain —
// while still concatenating genuinely distinct segments (e.g. across a
// pause, or a word repeated on purpose) normally.
//
// Corrected same day: an earlier version merged whenever a segment merely
// *started with* the previous one, which also matched an identical
// (equal-length) segment against itself — collapsing a genuinely repeated
// word ("test test test") down to one instance. Merging now requires the
// new segment to be strictly longer, not just a startsWith match.
export function mergeSpeechSegments(segments: string[]): string {
  const committed: string[] = [];
  for (const segment of segments) {
    const last = committed[committed.length - 1];
    // Strictly-longer is required, not just startsWith — an *equal-length*
    // (i.e. identical) segment is a separately recognized utterance that
    // happens to repeat the same word(s) (e.g. genuinely saying "test test
    // test"), not a restatement of the previous one, and must be
    // concatenated, never merged away. Only a segment that's actually
    // longer and extends the previous one represents the same growing
    // utterance restating itself.
    if (last !== undefined && segment.length > last.length && segment.startsWith(last)) {
      committed[committed.length - 1] = segment;
    } else {
      committed.push(segment);
    }
  }
  return committed.join("");
}
