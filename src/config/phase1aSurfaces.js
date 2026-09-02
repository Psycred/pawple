/**
 * Phase 1a launch surface visibility (Founder 4ac03812 / PAW-112).
 *
 * Mating discovery, opt-in, matching, and introduction chat remain in the
 * repository. They must not be presented to Phase 1a users.
 *
 * This is a UI visibility gate only:
 * - not authorization to delete mating screens, services, RPCs, or tables
 * - not a security control (RLS / RPCs stay the source of truth)
 * - not a schema change
 *
 * Founder 4ac03812 / CURRENT.md (2026-09-02): hide Phase 1a launch
 * surfaces only. Do not strip mating code.
 */
export const EXPOSE_MATING_SURFACES = false;
