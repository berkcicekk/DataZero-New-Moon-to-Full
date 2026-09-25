/**
 * Local identity and profile for the DataZero CLI flows.
 *
 * Nothing here ever leaves the machine. The identity secret is derived from
 * the wallet seed so a given wallet always produces the same owner key and the
 * same nullifiers — deterministic across runs, but never written to the chain
 * and never sent to the proof server in the clear.
 */

import { createHash } from 'node:crypto';

import type { AudienceProfile } from './witnesses.js';

/** Domain separation: the identity secret is not the wallet seed. */
const IDENTITY_DOMAIN = 'datazero:identity:v1';

/**
 * 32-byte DataZero identity secret for a wallet seed.
 *
 * Deriving rather than reusing the seed means a leaked DataZero secret cannot
 * be replayed against the wallet.
 */
export const deriveIdentitySecret = (seed: string): Uint8Array =>
  new Uint8Array(createHash('sha256').update(`${IDENTITY_DOMAIN}:${seed}`).digest());

/** 32-byte tag for an interest category, zero-padded UTF-8. */
export const segmentTag = (category: string): Uint8Array => {
  const encoded = new TextEncoder().encode(category);
  if (encoded.length > 32) {
    throw new Error(`Interest category "${category}" does not fit in 32 bytes`);
  }
  const tag = new Uint8Array(32);
  tag.set(encoded);
  return tag;
};

/** Human-readable form of a 32-byte tag, for printing ledger values back. */
export const readSegmentTag = (tag: Uint8Array): string =>
  new TextDecoder().decode(tag).replace(/\0+$/, '');

/**
 * The profile the advertiser side uses. `openCampaign` and `closeCampaign`
 * never read `localProfile()`, so an empty profile is correct there — and
 * keeps the advertiser from carrying user-shaped data it has no use for.
 */
export const emptyProfile = (): AudienceProfile => ({
  ageBracket: 0n,
  interestTag: new Uint8Array(32),
  engagementScore: 0n,
});

/**
 * The local user's profile, read from the environment so it stays out of the
 * repository.
 *
 *   DATAZERO_AGE_BRACKET   1-6   (1 = 18-24 ... 6 = 65+)
 *   DATAZERO_INTEREST      e.g. "travel"
 *   DATAZERO_ENGAGEMENT    0-10000
 */
export const localProfileFromEnv = (env: NodeJS.ProcessEnv = process.env): AudienceProfile => {
  const ageBracket = BigInt(env.DATAZERO_AGE_BRACKET ?? '3');
  const engagementScore = BigInt(env.DATAZERO_ENGAGEMENT ?? '7200');

  if (ageBracket < 0n || ageBracket > 6n) {
    throw new Error('DATAZERO_AGE_BRACKET must be between 0 and 6');
  }
  if (engagementScore < 0n || engagementScore > 10000n) {
    throw new Error('DATAZERO_ENGAGEMENT must be between 0 and 10000');
  }

  return {
    ageBracket,
    interestTag: segmentTag(env.DATAZERO_INTEREST ?? 'travel'),
    engagementScore,
  };
};
