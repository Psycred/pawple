/**
 * Product-level visibility for Mating surfaces.
 *
 * Pet opt-in and mutual-channel eligibility remain separate, server-backed
 * conditions. This switch only allows the profile control and conditional
 * navigation entries to participate in those checks.
 */
export const EXPOSE_MATING_SURFACES = true;

export function areMatingSurfacesVisible() {
  return EXPOSE_MATING_SURFACES;
}
