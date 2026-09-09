// Deterministic, dev-only public-id derivation for the local/demo data
// layer, so links built from different in-memory copies of the same seed
// story (the contract-layer local adapter in `src/lib/data/local/seed.ts`
// and the older legacy `src/data` module) always agree on the same numeric
// id for a given slug — without editing the checked-in seed JSON by hand.
//
// This is NOT how real public ids are generated. In production (Supabase),
// `stories.public_id` is a genuinely random 9-digit integer assigned at
// insert time by `generate_story_public_id()` (see
// `supabase/migrations/0016_story_public_id.sql`), not derived from the
// slug. This helper only exists so the local demo backend has something
// numeric and stable to route on.
export function publicIdForSlug(slug: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const n = 100_000_000 + ((h >>> 0) % 900_000_000)
  return String(n)
}
