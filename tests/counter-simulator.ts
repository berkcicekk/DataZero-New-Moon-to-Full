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
   * Everything the chain would hold for this contract, flattened for leak
   * hunting: a text rendering plus every byte string found in the encoded
   * state. If a secret ever reached the ledger it would have to show up in one
   * of the two.
   */
  public publicStateDump(): { text: string; bytes: Uint8Array } {
    const state = this.circuitContext.currentQueryContext.state.state;
    const chunks: Uint8Array[] = [];

    const walk = (node: unknown): void => {
      if (node == null) return;
      if (node instanceof Uint8Array) {
        chunks.push(node);
        return;
      }
      if (ArrayBuffer.isView(node)) {
        const view = node as ArrayBufferView;
        chunks.push(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === 'object') {
        Object.values(node as Record<string, unknown>).forEach(walk);
      }
    };

    walk(state.encode());

    const total = chunks.reduce((n, c) => n + c.length, 0);
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    return { text: state.toString(), bytes };
  }
}
