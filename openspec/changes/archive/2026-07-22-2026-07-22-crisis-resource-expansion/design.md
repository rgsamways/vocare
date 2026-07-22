## Decisions

**Additive data change, not a behavior change.** `getCrisisResource()`'s logic (country → specific resource, or generic fallback if unmapped) is untouched. What changed is the size of the map it looks up against, and Canada's display content. This keeps the change's actual risk surface narrow: the thing that could be wrong is "is this phone number/org real and current for this country," not "did the lookup/fallback mechanism break."

**Country-level granularity accepted, sub-country (region/language) granularity deliberately deferred.** Researching this surfaced two real cases where "one resource per country" doesn't fit: Belgium (three regional lines, no national one) and Italy (no national line, but a real one for German-speakers in South Tyrol specifically, via `findahelpline.com/countries/it/bz`). Building real region+language-aware resource selection is a legitimate fix but a materially bigger data-model and UI change (the country field would need to become country+region, and the safety-card UI would need to handle showing "which region are you in" for the handful of countries that need it) — logged in spec Section 24 rather than attempted here. The alternative — approximating a single number for a fragmented country — was rejected as worse than exclusion: it would misrepresent which specific line a given user would actually reach.

**Excluded countries stay excluded from the dropdown, not shown with a caveated/partial entry.** Five countries (Italy, Turkey, Saudi Arabia, Bulgaria, Cyprus) were researched and found to have no single clean 24/7 national line. Rather than show an approximate best-effort number, they're simply not offered as a sign-up choice — a user from one of these countries selects the closest fit or "Other," which correctly routes to the generic international fallback. This matches the principle the whole change was built around: don't offer specificity the backend can't actually deliver.

**Research done via live web search this session, not recalled from training data.** Given the real-harm stakes of a wrong crisis-line number, each entry was checked against a primary source (a government health ministry page, or the resource organization's own site) at research time, not asserted from memory. This is a meaningfully different (and more defensible) provenance than the 3 original entries, which were never documented as sourced one way or the other.

**Not migrating to a hosted vendor (ThroughLine) in this change.** Their product would likely resolve the region/language gap this change accepts, but there's no public pricing and no free tier — real cost requires a sales conversation ("service order"). Swapping the resource-lookup mechanism entirely is a bigger, more deliberate decision than expanding a data map, and shouldn't happen as a side effect of this change. Logged as an open item in `FIXLIST.md`.

## Risks / Trade-offs

- **AI-assisted research is not the professional review the spec already calls for.** `design.md`'s own predecessor (`m2-conversation-engine`) flagged that crisis-resource content needs professional (not just legal) review before real launch. This change is a large, sourced improvement over the 3-country baseline — it is not that review, and shouldn't be treated as having satisfied it.
- **Sourced-at-research-time is not the same as verified-to-stay-current.** A number correct as of 2026-07-22 can change; nothing in this change adds ongoing monitoring for that. Same staleness risk the Canada bug itself demonstrates, just with a larger surface now (31 entries instead of 3).
- **No compile-time link between the two workspaces' country lists.** `web/src/lib/detect-country.ts` and `backend/src/config.ts` are in different npm workspaces; keeping them in sync is a manual-discipline requirement, mitigated by (not eliminated by) the new regression test that hardcodes the dropdown list and fails if it drifts from `CRISIS_RESOURCES`'s keys.
- **This change was built and applied single-instance, without the two-instance grading CLAUDE.md calls for on crisis-safety work.** Named explicitly in `proposal.md`'s Why section — the instance grading this should treat that as a real gap to close, not a formality.

## Migration Plan

No database changes, no env vars, no backend/frontend contract changes — this is a data-content change plus a new regression test. Existing behavior for the 3 original countries is preserved (Canada's *number* is unchanged; only its display name/description changed).

## Open Questions

- **Should Belgium/Italy's region-granularity gap get built, and when?** Not resolved here — logged in spec Section 24. Revisit if either exclusion becomes a real user complaint, or alongside a possible future ThroughLine migration.
- **Is ThroughLine worth pursuing given real pricing?** Not resolved here — no pricing was obtainable without a sales conversation. Logged in `FIXLIST.md`.
- **Exact resource content still needs the professional review the spec has flagged since M2's own design.md** — not resolved by this change, which is AI-assisted research, not that review.
