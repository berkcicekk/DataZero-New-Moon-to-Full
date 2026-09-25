# DataZero-New-Moon-to-Full

> A privacy-preserving decentralized advertising data marketplace built on Midnight. 

DataZero allows users to prove specific behavioral or demographic attributes without revealing their real identity or personal data to advertisers. Using Compact circuits and private witnesses, users monetize their data insights securely while maintaining absolute anonymity on-chain.

<img width="704" height="294" alt="image" src="https://github.com/user-attachments/assets/c7fc00d1-672a-470b-bbd5-30540cf94189" />

## 🚀 Overview (Level 1: New Moon)

DataZero is developed as part of the **Monthly Moonshots on Midnight** builder journey. This phase establishes the core toolchain, initial Compact smart contract structure, and baseline privacy architecture.

### Public State vs. Private Witness
- **Private Witness:** User behavioral metrics, demographic tags, and identity markers remain entirely local on the user's device and are processed via zero-knowledge circuits.
- **Public Ledger State:** The Midnight smart contract only stores cryptographic commitments, interaction hashes, and aggregate metrics (`total_interactions`), ensuring zero data leakage.

---

## 🛠️ Prerequisites & Setup

Ensure you have the following toolchain installed locally:
- **Node.js** (v22+)
- **Docker** (Required for the proof server and compiler environment)
- **Midnight Compact Compiler & SDK**
