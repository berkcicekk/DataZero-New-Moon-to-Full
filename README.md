# DataZero

> A Compact contract that lets a person prove they match an advertiser's target audience — and lets the advertiser count them — without either side learning who they are.

DataZero is built for the **Monthly Moonshots on Midnight** builder journey. This repository is **Level 1 · New Moon**: the toolchain, the first Compact contract, its test suite, and a deploy path to the public test networks.

<img width="704" height="294" alt="DataZero" src="https://github.com/user-attachments/assets/c7fc00d1-672a-470b-bbd5-30540cf94189" />

---

## Contract Address

| Network | Address |
|---------|---------|
| Preview | `[PASTE ADDRESS AFTER DEPLOY]` |
| Preprod | `[PASTE ADDRESS AFTER DEPLOY]` |

> `npm run deploy -- --network preview` prints the address in a box when it finishes, and also writes it to `.midnight-state.json`. Paste it into the table above.

---

## What This Does

An advertiser opens a campaign on-chain and publishes what it is looking for: an interest segment, a minimum age bracket, and a minimum engagement score. Those are the advertiser's own criteria, so they are public.

A person who wants to be counted runs `attest()`. Their profile — age bracket, interest tag, engagement score — stays on their device as a **private witness**. The circuit checks the profile against the published criteria and produces a proof that the checks passed. The chain learns only two things: the aggregate counter moved by one, and a **nullifier** was added to a set.

The nullifier is a one-way hash of `(domain tag, campaign segment, user secret)`. It is what stops the same person claiming a campaign twice. It is not invertible, and because it is bound to the campaign segment, the same person produces a completely unrelated nullifier for every other campaign — so two advertisers cannot compare their sets and discover they share an audience.

The advertiser ends up with the number they actually wanted: how many qualified people engaged. They never receive a profile, an identity, or anything they could join against another dataset.

### Circuits

| Circuit | Who calls it | What it does |
|---------|--------------|--------------|
| `openCampaign(segment, minAge, minScore)` | campaign owner | Publishes the targeting criteria, moves the campaign `CLOSED → OPEN`. |
| `attest()` | any user | Proves the three eligibility conditions over private data, records a nullifier, increments the counter. |
| `closeCampaign()` | campaign owner | Moves the campaign `OPEN → CLOSED`. The counter and nullifier set are kept. |
| `deriveOwnerKey(sk)` | pure | Domain-separated owner identity hash. |
| `deriveNullifier(sk, segment)` | pure | Domain-separated, campaign-bound claim tag. |

---

## Privacy Model

**PUBLIC — on the Midnight ledger, readable by anyone**

| Field | Why it is public |
|-------|------------------|
| `campaignOwner: Bytes<32>` | Hash of the owner's secret. Enforces owner-only circuits without revealing the secret. |
| `state: CampaignState` | `OPEN` or `CLOSED`. Users need to know whether the campaign accepts proofs. |
| `campaignSegment: Bytes<32>` | The advertiser's own targeting criterion, not user data. |
| `minAgeBracket: Uint<8>` | The advertiser's own criterion. Users must be able to see what they are proving against. |
| `minEngagement: Uint<16>` | Same. |
| `attestations: Set<Bytes<32>>` | One-way nullifiers. Enforces one claim per identity per campaign. |
| `totalInteractions: Counter` | The aggregate the advertiser is buying. The only user-derived number that becomes public. |

**PRIVATE — a witness, evaluated locally, never on-chain**

| Witness | What it holds |
|---------|---------------|
| `localSecretKey(): Bytes<32>` | The user's identity secret. Root of both the owner key and every nullifier. Never leaves the device. |
| `localProfile(): AudienceProfile` | `ageBracket`, `interestTag`, `engagementScore`. Read inside the circuit, compared, discarded. No field is ever written to the ledger. |

**WHAT THE USER PROVES WITHOUT REVEALING**

> "My private interest tag equals the campaign's segment, my age bracket is at or above the campaign minimum, my engagement score is at or above the campaign minimum, and I have not already claimed this campaign."

The advertiser learns that the statement is true. They do not learn the age bracket, the exact engagement score, the identity, or whether this person also attested to any other campaign.

**Where `disclose()` is used, and why**

`counter.compact` calls `disclose()` in exactly three places, each deliberate:

1. **The constructor** discloses `deriveOwnerKey(localSecretKey())` — a hash, not the secret. Without it there would be no way to check ownership later.
2. **`openCampaign`** discloses the segment, minimum age bracket and minimum engagement score. These are the advertiser's inputs, published on purpose.
3. **`attest`** discloses the nullifier, and nothing else. The ledger needs it to reject double claims; it is preimage-resistant, so publishing it leaks neither the secret key nor the profile.

No circuit ever discloses a field of `localProfile()`.

---

## Tech Stack

- **Midnight** — Preview / Preprod test networks
- **Compact** — contract language, compiler `0.31.1` (pinned in `.compact-version`), language version `>= 0.23`
- **Node.js v22+** and **TypeScript 5.9**
- **Midnight.js 4.1.1** — `midnight-js-contracts`, `midnight-js-protocol`, indexer / proof / private-state providers
- **Docker** — proof server (`midnightntwrk/proof-server:8.1.0`) and, for local development, node + indexer
- **Vitest** — contract test suite, running the real compiled circuits in-process

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js v22 or newer | `node --version` |
| Docker | Needed for the proof server. `docker compose version` |
| Compact compiler `0.31.1` | Install below. |
| A funded Preview or Preprod wallet | Only for deploying; tests and compilation need neither. |

### Installing the Compact compiler

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1
compact --version
```

**On Windows:** the compiler is published for Linux and macOS only — there is no Windows build. Use one of:

- **WSL2** (recommended): `wsl --install` from an elevated PowerShell, reboot, then run the installer above inside the Linux shell. Docker Desktop with the WSL2 backend then serves both the compiler and the proof server.
- **GitHub Actions**: push, and [`.github/workflows/ci.yml`](.github/workflows/ci.yml) compiles the contract, runs the test suite, and uploads `managed/counter` as a downloadable artifact.

---

## Setup

```bash
git clone https://github.com/berkcicekk/DataZero-New-Moon-to-Full.git
cd DataZero-New-Moon-to-Full
npm install

cp .env.example .env        # your local profile — the private witness

npm run compile             # -> managed/counter/{contract,keys,zkir}
npm test
```

### Deploying

```bash
npm run proof-server:start          # docker compose up -d
npm run deploy -- --network preview
```

The deploy script generates a wallet on first run and prints its 24-word recovery phrase and address, then waits. Fund the address at the [Preview faucet](https://midnight-tmnight-preview.nethermind.dev) (Preprod: [here](https://midnight-tmnight-preprod.nethermind.dev)); it polls until the tNIGHT lands and then continues on its own. When it finishes it prints the contract address in a box.

`npm run setup -- --network preview` runs proof server → compile → deploy in one go.

### Interacting

```bash
npm run cli
```

Menu: open a campaign, send an attestation, read the public ledger state, close the campaign, check balances. Option 3 is the interesting one — it shows exactly what the chain holds, which is an aggregate and a set of hashes.

### Useful commands

| Command | What it does |
|---------|--------------|
| `npm run compile` | Compile `contracts/counter.compact` into `managed/counter`. |
| `npm test` | Run the Vitest suite against the compiled circuits. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run network preview` | Switch the active network. |
| `npm run check-balance` | Wallet tNIGHT and DUST balances. |
| `npm run clean` | Remove `managed/counter` and the local wallet/deploy state. |

---

## Run Tests

```bash
npm run compile   # tests exercise the real compiled circuits, so compile first
npm test
```

The suite is in [`tests/counter.test.ts`](tests/counter.test.ts) and covers the three areas Level 1 asks for:

**Circuit logic**
- a qualifying profile is accepted and the counter increments
- each of the three eligibility criteria is enforced separately (wrong segment, age bracket too low, engagement too low)
- a second attestation from the same identity is rejected
- only the owner can open or close a campaign

**State transitions**
- a fresh deployment is `CLOSED`, with an empty nullifier set and a zero counter
- `openCampaign` publishes the criteria and flips `CLOSED → OPEN`
- attestations accumulate across distinct users
- `closeCampaign` flips `OPEN → CLOSED` and keeps the aggregate; further attestations are refused

**Private inputs are never exposed**
- the identity secret appears nowhere in the serialized public ledger, in either its byte or its text rendering
- what the ledger *does* hold is the nullifier, and the nullifier is not the secret
- running a circuit leaves the private state byte-for-byte unchanged
- the same user attesting to two campaigns produces two unlinkable nullifiers, neither of which appears in the other campaign's set

---

## Project Structure

```
DataZero-New-Moon-to-Full/
├── contracts/
│   └── counter.compact          # the Compact contract
├── managed/                     # generated by `npm run compile`
│   └── counter/
├── src/
│   ├── witnesses.ts             # private state + witness implementations
│   ├── identity.ts              # local identity and profile handling
│   ├── deploy.ts                # deploy to undeployed / preview / preprod
│   ├── cli.ts                   # interact with a deployed contract
│   ├── setup.ts                 # proof server -> compile -> deploy
│   ├── network.ts               # network config, wallet and deploy state
│   ├── wallet.ts                # wallet construction and sync
│   └── check-balance.ts
├── tests/
│   ├── counter.test.ts          # the suite
│   ├── counter-simulator.ts     # in-process contract testbed
│   └── utils.ts
├── .github/
│   └── workflows/
│       └── ci.yml               # compile + test on every push
├── docker-compose.yml           # proof server (+ local node and indexer)
├── .compact-version             # pinned compiler version
└── package.json
```

---

## Initial Idea

<!-- Bu bölümü kendin doldur: DataZero fikri nereden çıktı, hangi problemi çözüyor? -->

[LEAVE PLACEHOLDER — I will fill this in manually]

---

## Screenshots

<!-- Ekle: `npm run compile` çıktısı ve deploy sonundaki contract address kutusu. -->

[LEAVE PLACEHOLDER — I will add compile output and contract address screenshots]

---

## License

MIT
