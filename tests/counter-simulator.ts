/**
 * In-process testbed for the DataZero contract.
 *
 * Runs the real compiled circuits from `managed/counter` against the real
 * Compact runtime — no network, no proof server, no mocks. Each call threads
 * the resulting `CircuitContext` forward, so the simulator's public/private
 * state evolves exactly the way a deployed contract's would.
 */

import {
  type CircuitContext,
  CostModel,
  QueryContext,
  createConstructorContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';

import { Contract, type Ledger, ledger } from '../managed/counter/contract/index.js';
import {
  type AudienceProfile,
  type DataZeroPrivateState,
  witnesses,
} from '../src/witnesses.js';

/** The zero coin public key is fine here: no circuit moves funds. */
const TEST_COIN_PUBLIC_KEY = '0'.repeat(64);

export class DataZeroSimulator {
  readonly contract: Contract<DataZeroPrivateState>;
  circuitContext: CircuitContext<DataZeroPrivateState>;

  constructor(secretKey: Uint8Array, profile: AudienceProfile) {
    this.contract = new Contract<DataZeroPrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ secretKey, profile }, TEST_COIN_PUBLIC_KEY),
      );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /**
   * Swap in a different participant. The public ledger carries over — which is
   * the point: it models a second user hitting the same deployed contract.
   */
  public switchUser(secretKey: Uint8Array, profile: AudienceProfile): void {
    this.circuitContext.currentPrivateState = { secretKey, profile };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): DataZeroPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  // --- Circuits -------------------------------------------------------------

  public openCampaign(segment: Uint8Array, minAge: bigint, minScore: bigint): Ledger {
    this.circuitContext = this.contract.impureCircuits.openCampaign(
      this.circuitContext,
      segment,
      minAge,
      minScore,
    ).context;
    return this.getLedger();
  }

  public closeCampaign(): Ledger {
    this.circuitContext = this.contract.impureCircuits.closeCampaign(this.circuitContext).context;
    return this.getLedger();
  }

  public attest(): Ledger {
    this.circuitContext = this.contract.impureCircuits.attest(this.circuitContext).context;
    return this.getLedger();
  }

  // --- Pure circuits, callable without changing state ------------------------

  public ownerKey(secretKey: Uint8Array = this.getPrivateState().secretKey): Uint8Array {
    return this.contract.circuits.deriveOwnerKey(this.circuitContext, secretKey).result;
  }

  public nullifier(
    segment: Uint8Array,
    secretKey: Uint8Array = this.getPrivateState().secretKey,
  ): Uint8Array {
    return this.contract.circuits.deriveNullifier(this.circuitContext, secretKey, segment).result;
  }

  // --- Public-state inspection ----------------------------------------------

  /**
   * Everything the chain would hold for this contract, in two forms: the
   * runtime's own full rendering, and every byte run in it concatenated.
   *
   * `toString(false)` is the complete dump. `encode()` is not: it elides the
   * contents of map-backed state, which would silently make a leak hunt pass
   * vacuously because the nullifier set is exactly where a leak would land.
   * Every value in the rendering is printed as `<[hex]: alignment>`, so
   * pulling the bracketed hex runs out yields the full public byte image -
   * cells and nullifier-set keys alike.
   */
  public publicStateDump(): { text: string; bytes: Uint8Array } {
    const text = this.circuitContext.currentQueryContext.state.state.toString(false);

    const runs = [...text.matchAll(/\[([0-9a-fA-F]*)\]/g)]
      .map((m) => m[1])
      .filter((hex) => hex.length > 0 && hex.length % 2 === 0)
      .map((hex) => Uint8Array.from(Buffer.from(hex, 'hex')));

    const bytes = new Uint8Array(runs.reduce((n, r) => n + r.length, 0));
    let offset = 0;
    for (const run of runs) {
      bytes.set(run, offset);
      offset += run.length;
    }

    return { text, bytes };
  }
}
