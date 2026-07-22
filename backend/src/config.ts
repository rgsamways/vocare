/**
 * Placeholder values pending legal review / real beta usage data — see
 * design.md's Open Questions and proposal.md. Not finalized by this change.
 */

/** Recommended target (16+), not Claude's absolute 13+ floor. Revisit after legal review. */
export const MINIMUM_AGE = 16;

export const FREE_SESSION_LIMIT = 3;

/** Rolling-window fair-use velocity cap. Sized loosely for 2-3 real sessions/day; not tuned against beta data. */
export const FAIR_USE_CAP = {
  per24h: 6,
  per30d: 60,
};

export const STRIPE_PRICE_USD_CENTS = 2900;
