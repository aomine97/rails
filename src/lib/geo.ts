/**
 * California (Civ. Code §1812.500+) and New York (GBL Art. 11) regulate "job listing services".
 * Until counsel signs off, users in those states can't sign up. Copy is in the onboarding screen.
 */
export const GATED_STATES = new Set(["CA", "NY"]);
export const isGated = (state: string | null | undefined) => !!state && GATED_STATES.has(state.toUpperCase());
export const GATE_COPY = "Rails isn't available in California or New York yet. Leave your email and we'll tell you the day it is.";
