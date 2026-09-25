/**
 * CLI for interacting with the deployed DataZero contract.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import { Buffer } from 'buffer';

// Midnight SDK imports
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { resolveNetwork, getOrCreateWallet, formatWalletBackupNotice, getDeployment } from './network';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import {
  deriveIdentitySecret,
  localProfileFromEnv,
  readSegmentTag,
  segmentTag,
} from './identity';
import { createDataZeroPrivateState, witnesses } from './witnesses';

// Enable WebSocket for GraphQL subscriptions
// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

// Must match the privateStateId used at deploy time so the CLI reconnects to
// the same private state. DataZero's private state holds the identity secret
// and the local profile; see src/witnesses.ts.
const PRIVATE_STATE_ID = 'dataZeroPrivateState';

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;
{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'managed', 'counter');

// Load compiled contract
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

// Check if contract is compiled
if (!fs.existsSync(contractPath)) {
  console.error('\n❌ Contract not compiled! Run: npm run compile\n');
  process.exit(1);
}

const DataZero = await import(pathToFileURL(contractPath).href);

// The contract module is imported dynamically, because its bindings only exist
// after `npm run compile`. That makes `DataZero.Contract` an `any` to the type
// checker, which in turn defeats inference of the witness/context generics on
// `CompiledContract` - hence the casts. The runtime wiring is exact: the real
// witnesses from src/witnesses.ts are attached here.
const compiledContract: any = (CompiledContract.make('datazero', DataZero.Contract) as any).pipe(
  (CompiledContract.withWitnesses as any)(witnesses),
  (CompiledContract.withCompiledFileAssets as any)(zkConfigPath),
);

// ─── Providers ─────────────────────────────────────────────────────────────────

async function createProviders(walletCtx: WalletContext) {
  // The SDK requires the private-state password to be at least 16 characters.
  // The default below is a placeholder for local devnet only — set a strong
  // password via PRIVATE_STATE_PASSWORD when you move to a non-local target.
  const privateStatePassword = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';

  const walletProvider = {
    // In Midnight.js 4.1.x the WalletProvider interface returns the key objects
    // (CoinPublicKey / EncPublicKey) directly — no longer hex strings.
    getCoinPublicKey: () => walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: any, ttl?: Date) {
      // balanceUnboundTransaction -> finalizeRecipe is the complete balancing
      // path in wallet-sdk 1.x; the earlier explicit signRecipe step is gone.
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  const accountId = walletCtx.unshieldedKeystore.getBech32Address().toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: 'datazero-state',
      accountId,
      privateStoragePasswordProvider: () => privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Main CLI ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                   DataZero CLI                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const rl = createInterface({ input: stdin, output: stdout });

  // Check for deployment
  const deployment = getDeployment(network);
  if (!deployment) {
    console.error(`No deploy on file for network ${network}. Run \`npm run setup -- --network ${network}\` first.`);
    process.exit(1);
  }
  console.log(`  Contract: ${deployment.address}`);
  console.log(`  Network: ${network}\n`);

  try {
    const seed = SEED;

    console.log('  Connecting to wallet...');
    const walletCtx = await createWallet({ network, networkConfig, seed });
    const restoredCount = Object.values(walletCtx.restored).filter(Boolean).length;
    if (restoredCount > 0) {
      console.log(`  Restored ${restoredCount}/3 child wallets from .midnight-wallet-state — sync will resume from saved point.`);
    }

    console.log('  Syncing with network...');
    console.log('  ℹ  This may take several minutes depending on network size.');
    console.log('     RPC disconnection messages during sync are normal and can be safely ignored.\n');
    const syncStart = Date.now();
    const syncInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - syncStart) / 1000);
      process.stdout.write(`\r  ⏳ Still syncing... (${elapsed}s elapsed)   `);
    }, 5000);
    const state = await walletCtx.wallet.waitForSyncedState();
    clearInterval(syncInterval);
    process.stdout.write('\r  ✓ Synced with network.                                      \n');

    // Persist sync state so the next run doesn't have to redo this work.
    await persistWalletState(network, walletCtx);
    const balance = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    console.log(`  Balance: ${balance.toLocaleString()} tNight\n`);

    // Surface a faucet hint when a public-network wallet has 0 tNIGHT.
    // Reads (option 2) work without funds, but writes (option 1) need DUST
    // generated from registered NIGHT — without this hint the next failure
    // mode is a confusing "Insufficient Funds" deep inside the tx builder.
    if (balance === 0n && network !== 'undeployed' && networkConfig.faucet) {
      const address = walletCtx.unshieldedKeystore.getBech32Address();
      console.log('  ⚠ Wallet has no tNight. Fund it from the faucet to send transactions:');
      console.log(`     ${networkConfig.faucet}`);
      console.log(`     Wallet address: ${address}\n`);
    }

    // Setup providers and connect to contract
    console.log('  Connecting to contract...');
    const providers = await createProviders(walletCtx);

    const deployed: any = await findDeployedContract(providers, {
      compiledContract: compiledContract as any,
      contractAddress: deployment.address,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: createDataZeroPrivateState(
        deriveIdentitySecret(SEED),
        localProfileFromEnv(),
      ),
    });

    console.log('  ✅ Connected!\n');

    // Interactive CLI loop
    let running = true;
    while (running) {
      console.log('--- Menu -------------------------------------------------------');
      console.log('  1. Open a campaign            (advertiser, owner only)');
      console.log('  2. Attest to the campaign     (user, zero-knowledge proof)');
      console.log('  3. Read public campaign state');
      console.log('  4. Close the campaign         (advertiser, owner only)');
      console.log('  5. Check wallet balance');
      console.log('  6. Exit\n');

      const choice = await rl.question('  Your choice: ');

      switch (choice.trim()) {
        case '1': {
          const category = (await rl.question('  Interest segment (e.g. travel): ')).trim();
          const minAge = (await rl.question('  Minimum age bracket (0-6): ')).trim();
          const minScore = (await rl.question('  Minimum engagement (0-10000): ')).trim();
          console.log('\n  Submitting transaction (this may take 30-60 seconds)...');
          try {
            const tx = await deployed.callTx.openCampaign(
              segmentTag(category),
              BigInt(minAge),
              BigInt(minScore),
            );
            console.log(`\n  [ok] Campaign open on segment "${category}"`);
            console.log(`  Transaction ID: ${tx.public.txId}`);
            console.log(`  Block height: ${tx.public.blockHeight}\n`);
          } catch (error) {
            console.error('\n  [x] Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '2': {
          // The profile below never leaves this process: it is read from the
          // environment into the witness, proved against, and discarded. Only
          // the resulting nullifier reaches the chain.
          const profile = localProfileFromEnv();
          console.log('\n  Proving with your local profile (none of it is sent on-chain):');
          console.log(`    age bracket      ${profile.ageBracket}`);
          console.log(`    interest         ${readSegmentTag(profile.interestTag)}`);
          console.log(`    engagement score ${profile.engagementScore}`);
          console.log('\n  Generating proof and submitting (this may take 30-60 seconds)...');
          try {
            const tx = await deployed.callTx.attest();
            console.log('\n  [ok] Attestation accepted - the counter moved, your profile did not.');
            console.log(`  Transaction ID: ${tx.public.txId}`);
            console.log(`  Block height: ${tx.public.blockHeight}\n`);
          } catch (error) {
            console.error('\n  [x] Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '3': {
          console.log('\n  Reading public state from the chain...');
          try {
            const contractState = await providers.publicDataProvider.queryContractState(deployment.address);
            if (contractState) {
              const s = DataZero.ledger(contractState.data);
              const status = s.state === DataZero.CampaignState.OPEN ? 'OPEN' : 'CLOSED';
              console.log('\n  Public ledger state');
              console.log(`     status              ${status}`);
              console.log(`     segment             ${readSegmentTag(s.campaignSegment) || '(unset)'}`);
              console.log(`     min age bracket     ${s.minAgeBracket}`);
              console.log(`     min engagement      ${s.minEngagement}`);
              console.log(`     total interactions  ${s.totalInteractions}`);
              console.log(`     attestations        ${s.attestations.size()} nullifier(s)`);
              console.log(`     owner key           ${Buffer.from(s.campaignOwner).toString('hex')}\n`);
            } else {
              console.log('\n  No state found (contract state empty)\n');
            }
          } catch (error) {
            console.error('\n  [x] Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '4': {
          console.log('\n  Submitting transaction (this may take 30-60 seconds)...');
          try {
            const tx = await deployed.callTx.closeCampaign();
            console.log('\n  [ok] Campaign closed.');
            console.log(`  Transaction ID: ${tx.public.txId}`);
            console.log(`  Block height: ${tx.public.blockHeight}\n`);
          } catch (error) {
            console.error('\n  [x] Failed:', error instanceof Error ? error.message : error);
          }
          break;
        }

        case '5': {
          console.log('\n  Checking balance...');
          const currentState = await walletCtx.wallet.waitForSyncedState();
          const currentBalance = currentState.unshielded.balances[unshieldedToken().raw] ?? 0n;
          const dustBalance = currentState.dust.balance(new Date());
          console.log(`\n  tNight: ${currentBalance.toLocaleString()}`);
          console.log(`  DUST: ${dustBalance.toLocaleString()}\n`);
          break;
        }

        case '6':
          running = false;
          console.log('\n  Goodbye!\n');
          break;

        default:
          console.log('\n  [x] Invalid choice. Please enter 1-6.\n');
      }
    }

    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
