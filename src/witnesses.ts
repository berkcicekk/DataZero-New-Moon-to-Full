/**
 * DataZero private state and witness implementations.
 *
 * Everything in this file lives on the user's own machine. The Compact
 * compiler turns each `witness` declaration in contracts/counter.compact into
 * a hole that the prover must fill locally; these functions are what fills
 * them. Values returned here enter the circuit as private inputs and are only
 * ever visible on-chain if a circuit explicitly calls `disclose()` on them.
 *
 * `counter.compact` calls `disclose()` on exactly one witness-derived value —
 * the nullifier, which is a preimage-resistant hash. Neither the secret key
 * nor any field of the profile is disclosed anywhere.
 */

import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

import type { Ledger } from '../managed/counter/contract/index.js';

/**
 * The user's behavioural profile, matching the `AudienceProfile` struct in
 * contracts/counter.compact.
 *
 * Declared structurally rather than imported from the generated bindings so
 * this module stays readable (and type-checkable) before the first
 * `npm run compile`. Compact maps `Uint<N>` to `bigint` and `Bytes<32>` to
 * `Uint8Array`.
 */
export type AudienceProfile = {
  /** 1 = 18-24, 2 = 25-34, 3 = 35-44, 4 = 45-54, 5 = 55-64, 6 = 65+ */
  readonly ageBracket: bigint;
  /** 32-byte hash of an interest category, e.g. "travel" or "fintech". */
  readonly interestTag: Uint8Array;
  /** 0-10000; how actively the user engages with that category. */
  readonly engagementScore: bigint;
};

/**
 * The complete private state of a DataZero participant. This object is held in
 * the local private-state store (LevelDB on the CLI, IndexedDB in a browser)
 * and is never transmitted to the node, the indexer, or the proof server in
 * plaintext.
 */
export type DataZeroPrivateState = {
  /** 32-byte identity secret. The root of both the owner key and nullifiers. */
  readonly secretKey: Uint8Array;
  /** The behavioural profile the user proves things about. */
  readonly profile: AudienceProfile;
};

export const createDataZeroPrivateState = (
  secretKey: Uint8Array,
  profile: AudienceProfile,
): DataZeroPrivateState => ({ secretKey, profile });

/**
 * Witness implementations, one per `witness` declaration in the contract.
 *
 * Each takes a `WitnessContext` (ledger view, private state, contract address)
 * and returns `[nextPrivateState, value]`. Both witnesses below are pure
 * reads: they hand the value to the circuit and leave the private state
 * untouched, which is what lets the tests assert that running a circuit never
 * mutates or leaks private data.
 */
export const witnesses = {
  localSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, DataZeroPrivateState>): [DataZeroPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],

  localProfile: ({
    privateState,
  }: WitnessContext<Ledger, DataZeroPrivateState>): [DataZeroPrivateState, AudienceProfile] => [
    privateState,
    privateState.profile,
  ],
};
