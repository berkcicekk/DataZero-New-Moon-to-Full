import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum CampaignState { CLOSED = 0, OPEN = 1 }

export type AudienceProfile = { ageBracket: bigint;
                                interestTag: Uint8Array;
                                engagementScore: bigint
                              };

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  localProfile(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, AudienceProfile];
}

export type ImpureCircuits<PS> = {
  openCampaign(context: __compactRuntime.CircuitContext<PS>,
               segment_0: Uint8Array,
               minAge_0: bigint,
               minScore_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeCampaign(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  attest(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  openCampaign(context: __compactRuntime.CircuitContext<PS>,
               segment_0: Uint8Array,
               minAge_0: bigint,
               minScore_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeCampaign(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  attest(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  deriveOwnerKey(sk_0: Uint8Array): Uint8Array;
  deriveNullifier(sk_0: Uint8Array, segment_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  deriveOwnerKey(context: __compactRuntime.CircuitContext<PS>, sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  deriveNullifier(context: __compactRuntime.CircuitContext<PS>,
                  sk_0: Uint8Array,
                  segment_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  openCampaign(context: __compactRuntime.CircuitContext<PS>,
               segment_0: Uint8Array,
               minAge_0: bigint,
               minScore_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  closeCampaign(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  attest(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly campaignOwner: Uint8Array;
  readonly state: CampaignState;
  readonly campaignSegment: Uint8Array;
  readonly minAgeBracket: bigint;
  readonly minEngagement: bigint;
  attestations: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly totalInteractions: bigint;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
