/**
 * DataZero contract tests.
 *
 * Three things are covered, matching the Level 1 requirements:
 *   1. Circuit logic        — the eligibility rules and the owner checks.
 *   2. State transitions    — CLOSED -> OPEN -> attestations -> CLOSED.
 *   3. Private-input safety  — secrets and profile fields never reach the
 *                              public ledger, and circuits never mutate them.
 */

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { beforeEach, describe, expect, it } from 'vitest';

import { CampaignState } from '../managed/counter/contract/index.js';
import type { AudienceProfile } from '../src/witnesses.js';
import { DataZeroSimulator } from './counter-simulator.js';
import { containsBytes, randomBytes, segmentTag } from './utils.js';

setNetworkId('undeployed');

const TRAVEL = segmentTag('travel');
const FINTECH = segmentTag('fintech');

const MIN_AGE_BRACKET = 2n;
const MIN_ENGAGEMENT = 4000n;

/** Matches the campaign on all three criteria. */
const qualifyingProfile = (): AudienceProfile => ({
  ageBracket: 3n,
  interestTag: TRAVEL,
  engagementScore: 7200n,
});

/** Advertiser-side profile: never read, because only `attest` touches it. */
const advertiserProfile = (): AudienceProfile => ({
  ageBracket: 0n,
  interestTag: new Uint8Array(32),
  engagementScore: 0n,
});

/** A simulator whose campaign is already open, plus the owner's secret. */
const openCampaign = (): { sim: DataZeroSimulator; ownerKey: Uint8Array } => {
  const ownerKey = randomBytes(32);
  const sim = new DataZeroSimulator(ownerKey, advertiserProfile());
  sim.openCampaign(TRAVEL, MIN_AGE_BRACKET, MIN_ENGAGEMENT);
  return { sim, ownerKey };
};

describe('DataZero — deployment and campaign setup', () => {
  it('derives the same initial ledger for the same deployer secret', () => {
    const secret = randomBytes(32);
    const a = new DataZeroSimulator(secret, advertiserProfile());
    const b = new DataZeroSimulator(secret, advertiserProfile());

    // The Ledger object is a live view backed by WASM handles, so comparing
    // two of them structurally compares handles, not contents. The serialized
    // public state is the contract's real output, and that is what has to
    // match: same deployer secret, byte-identical ledger.
    expect(a.publicStateDump().text).toEqual(b.publicStateDump().text);
    expect(a.getLedger().campaignOwner).toEqual(b.getLedger().campaignOwner);

    // A different secret must produce a different owner key, or the assertion
    // above would hold for any two deployments and prove nothing.
    const other = new DataZeroSimulator(randomBytes(32), advertiserProfile());
    expect(other.getLedger().campaignOwner).not.toEqual(a.getLedger().campaignOwner);
  });

  it('starts closed, with no attestations and a zero counter', () => {
    const secret = randomBytes(32);
    const sim = new DataZeroSimulator(secret, advertiserProfile());
    const state = sim.getLedger();

    expect(state.state).toEqual(CampaignState.CLOSED);
    expect(state.totalInteractions).toEqual(0n);
    expect(state.attestations.size()).toEqual(0n);
    expect(state.campaignSegment).toEqual(new Uint8Array(32));
    expect(state.minAgeBracket).toEqual(0n);
    expect(state.minEngagement).toEqual(0n);
    // The owner is identified by a hash of the secret, never the secret.
    expect(state.campaignOwner).toEqual(sim.ownerKey(secret));
    expect(state.campaignOwner).not.toEqual(secret);
  });

  it('publishes the campaign criteria and flips CLOSED -> OPEN', () => {
    const secret = randomBytes(32);
    const sim = new DataZeroSimulator(secret, advertiserProfile());

    const state = sim.openCampaign(TRAVEL, MIN_AGE_BRACKET, MIN_ENGAGEMENT);

    expect(state.state).toEqual(CampaignState.OPEN);
    expect(state.campaignSegment).toEqual(TRAVEL);
    expect(state.minAgeBracket).toEqual(MIN_AGE_BRACKET);
    expect(state.minEngagement).toEqual(MIN_ENGAGEMENT);
  });

  it('rejects a second open, and rejects a close from a non-owner', () => {
    const { sim } = openCampaign();

    expect(() => sim.openCampaign(FINTECH, 1n, 0n)).toThrow(
      'DataZero: campaign is already open',
    );

    sim.switchUser(randomBytes(32), qualifyingProfile());
    expect(() => sim.closeCampaign()).toThrow(
      'DataZero: only the campaign owner can close a campaign',
    );
  });
});

describe('DataZero — attestation circuit logic', () => {
  let sim: DataZeroSimulator;

  beforeEach(() => {
    sim = openCampaign().sim;
  });

  it('accepts a qualifying profile and increments the public counter', () => {
    const userKey = randomBytes(32);
    sim.switchUser(userKey, qualifyingProfile());

    const state = sim.attest();

    expect(state.totalInteractions).toEqual(1n);
    expect(state.attestations.size()).toEqual(1n);
    expect(state.attestations.member(sim.nullifier(TRAVEL, userKey))).toBe(true);
  });

  it('counts distinct users independently', () => {
    const alice = randomBytes(32);
    const bob = randomBytes(32);

    sim.switchUser(alice, qualifyingProfile());
    sim.attest();
    sim.switchUser(bob, qualifyingProfile());
    const state = sim.attest();

    expect(state.totalInteractions).toEqual(2n);
    expect(state.attestations.size()).toEqual(2n);
    expect(sim.nullifier(TRAVEL, alice)).not.toEqual(sim.nullifier(TRAVEL, bob));
  });

  it('refuses a second attestation from the same identity', () => {
    sim.switchUser(randomBytes(32), qualifyingProfile());
    sim.attest();

    expect(() => sim.attest()).toThrow(
      'DataZero: this identity has already attested to the campaign',
    );
    expect(sim.getLedger().totalInteractions).toEqual(1n);
  });

  it('refuses profiles that miss any one of the three criteria', () => {
    const cases: Array<[string, AudienceProfile, string]> = [
      [
        'wrong segment',
        { ...qualifyingProfile(), interestTag: FINTECH },
        'DataZero: profile does not match the campaign segment',
      ],
      [
        'age bracket too low',
        { ...qualifyingProfile(), ageBracket: 1n },
        'DataZero: age bracket below the campaign minimum',
      ],
      [
        'engagement too low',
        { ...qualifyingProfile(), engagementScore: 10n },
        'DataZero: engagement score below the campaign minimum',
      ],
    ];

    for (const [, profile, message] of cases) {
      sim.switchUser(randomBytes(32), profile);
      expect(() => sim.attest()).toThrow(message);
    }

    expect(sim.getLedger().totalInteractions).toEqual(0n);
    expect(sim.getLedger().attestations.size()).toEqual(0n);
  });

  it('stops accepting attestations once the campaign is closed', () => {
    sim.switchUser(randomBytes(32), qualifyingProfile());
    sim.attest();

    const { sim: fresh, ownerKey } = openCampaign();
    fresh.switchUser(randomBytes(32), qualifyingProfile());
    fresh.attest();
    fresh.switchUser(ownerKey, advertiserProfile());
    const closed = fresh.closeCampaign();

    expect(closed.state).toEqual(CampaignState.CLOSED);
    // Closing keeps the aggregate — it is the advertiser's result.
    expect(closed.totalInteractions).toEqual(1n);

    fresh.switchUser(randomBytes(32), qualifyingProfile());
    expect(() => fresh.attest()).toThrow(
      'DataZero: campaign is not accepting attestations',
    );
  });
});

describe('DataZero — private inputs are never exposed', () => {
  it('keeps the secret key and profile out of the public ledger', () => {
    const { sim } = openCampaign();

    const userKey = randomBytes(32);
    const profile = qualifyingProfile();
    sim.switchUser(userKey, profile);
    sim.attest();

    const { text, bytes } = sim.publicStateDump();
    const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

    // The identity secret appears nowhere in public state, in either rendering.
    expect(containsBytes(bytes, userKey)).toBe(false);
    expect(text.toLowerCase()).not.toContain(hex(userKey));

    // The ledger carries the nullifier, and the nullifier is not the secret.
    const tag = sim.nullifier(TRAVEL, userKey);
    expect(containsBytes(bytes, tag)).toBe(true);
    expect(tag).not.toEqual(userKey);

    // The public ledger exposes an aggregate and a set of hashes — and nothing
    // shaped like the profile that qualified this user.
    const state = sim.getLedger();
    expect(Object.keys(state)).not.toContain('ageBracket');
    expect(Object.keys(state)).not.toContain('engagementScore');
    expect(state.totalInteractions).toEqual(1n);
  });

  it('leaves the private state untouched when a circuit runs', () => {
    const { sim } = openCampaign();
    const userKey = randomBytes(32);
    const profile = qualifyingProfile();

    sim.switchUser(userKey, profile);
    const before = sim.getPrivateState();
    sim.attest();

    expect(sim.getPrivateState()).toEqual(before);
    expect(sim.getPrivateState().secretKey).toEqual(userKey);
    expect(sim.getPrivateState().profile).toEqual(profile);
  });

  it('produces unlinkable nullifiers for the same user across campaigns', () => {
    const userKey = randomBytes(32);

    const travel = openCampaign().sim;
    travel.switchUser(userKey, qualifyingProfile());
    travel.attest();

    const fintechOwner = randomBytes(32);
    const fintech = new DataZeroSimulator(fintechOwner, advertiserProfile());
    fintech.openCampaign(FINTECH, MIN_AGE_BRACKET, MIN_ENGAGEMENT);
    fintech.switchUser(userKey, { ...qualifyingProfile(), interestTag: FINTECH });
    fintech.attest();

    const travelTag = travel.getLedger().attestations;
    const fintechTag = fintech.getLedger().attestations;

    // Same person, two campaigns, two unrelated on-chain tags: neither
    // advertiser can tell they are looking at the same user.
    expect(travel.nullifier(TRAVEL, userKey)).not.toEqual(fintech.nullifier(FINTECH, userKey));
    expect(travelTag.member(fintech.nullifier(FINTECH, userKey))).toBe(false);
    expect(fintechTag.member(travel.nullifier(TRAVEL, userKey))).toBe(false);
  });
});
