# Base Task Signing Tool

## Quick Start

1. Install dependencies

```bash
npm ci
```

2. Run the server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Task Repository Integration

To use this tool in a task repository like [contract-deployments](https://github.com/base/contract-deployments), clone this repo into the root of the task repo.

```bash
git clone https://github.com/base/task-signing-tool.git
```

### Expected Directory Layout

Place this repository at the root of your task repository. Network folders (e.g., `mainnet`, `sepolia`) must live alongside it, and each task must be a date-prefixed folder inside a network folder.

```12:40:root-of-your-task-repo
contract-deployments/             # your task repo root (example)
├─ task-signing-tool/             # this repo cloned here
│  ├─ src/
│  └─ ...
├─ mainnet/                       # network directory
│  ├─ 2025-06-04-upgrade-foo/     # task directory (YYYY-MM-DD-task-name)
│  │  ├─ README.md                # optional, used for status parsing
│  │  ├─ validations/
│  │  │  ├─ base-sc.json          # config for "Base SC" user type
│  │  │  ├─ coinbase.json         # config for "Coinbase" user type
│  │  │  └─ op.json               # config for "OP" user type
│  │  └─ foundry-project/         # directory where you run Foundry scripts
│  │     └─ ...
│  └─ 2025-07-12-upgrade-bar/
│     └─ ...
└─ sepolia/
   ├─ 2025-05-10-upgrade-baz/
   │  └─ ...
   └─ ...
```

Key requirements and notes:

- **Networks**: Supported networks are listed in `src/lib/constants.ts` and currently include `mainnet` and `sepolia`.
- **Task folder naming**: Task directories must begin with a date prefix, `YYYY-MM-DD-`, for example `2025-06-04-upgrade-foo`. The UI lists only folders matching that pattern.
- **Validation configs**: For each task, place config files under `validations/` named by user type in kebab-case plus `.json`:
  - "Base SC" → `base-sc.json`
  - "Coinbase" → `coinbase.json`
  - "OP" → `op.json`
- **Script execution**: The tool executes Foundry from the task directory root (`<network>/<task>/`). Ensure your Foundry project or script context is available under that path; the tool will run `forge script` with fields from your validation config (`scriptName`, optional `signature` and `args`, and `sender`). Temporary outputs like `temp-script-output.txt` will be written there.
- **Optional README parsing**: If `<network>/<task>/README.md` exists, the tool may parse it to display status and execution links.

### Task README structure

When present, each task's `README.md` is parsed to populate the UI. Place it at `<network>/<YYYY-MM-DD-slug>/README.md` and follow these rules:

- **Status line (required for status display)**: Include a line containing `Status:` within the first 20 lines. Recognized values are `PENDING`, `READY TO SIGN`, and `EXECUTED` (case-insensitive). If `EXECUTED` is not present and `READY TO SIGN` is not present, the status is treated as `PENDING`. Supported formats:

  - **Single-line with link (any one of these)**:
    - `Status: EXECUTED (https://explorer/tx/0x...)`
    - `Status: [EXECUTED](https://explorer/tx/0x...)`
    - `Status: EXECUTED https://explorer/tx/0x...`
  - **Multi-line links (up to 5 lines after the status line)**:
    - First line: `Status: EXECUTED`
    - Next lines: `Label: https://...` (e.g., `Transaction: https://...`, `Proposal: https://...`)

- **Description (optional but recommended)**: Add a `## Description` section. The first paragraph after this header is shown in the UI and should be concise (aim for ≤150 chars). Formatting like bold, italics, and inline code is stripped.

- **Title (optional)**: You may start with a `#` title. It is ignored for parsing the description fallback, but is fine for readability.

- **Task name display**: The UI derives the display name from the folder slug after the date (e.g., `2025-06-04-upgrade-system-config` → `Upgrade System Config`). Choose meaningful slugs.

Examples

Minimal pending task:

```markdown
# Upgrade System Config

Status: PENDING

## Description

Upgrade System Config to enable feature flags for new modules.
```

Ready to sign:

```markdown
# Upgrade System Config

Status: READY TO SIGN

## Description

Multisig proposal prepared; awaiting signatures from designated signers.
```

Executed with single-line link:

```markdown
# Upgrade System Config

Status: EXECUTED (https://explorer/tx/0xabc123)

## Description

Executed upgrade to System Config with no parameter changes to gas config.
```

Executed with multiple labeled links:

```markdown
# Upgrade System Config

Status: EXECUTED
Transaction: https://explorer/tx/0xabc123
Proposal: https://snapshot.org/#/proposal/0xdef456

## Description

Executed upgrade; links include both onchain transaction and governance proposal.
```

### Validation file structure

Validation configs live under each task directory at `<network>/<YYYY-MM-DD-slug>/validations/` and are selected by user type:

- `base-sc.json` for **Base SC**
- `coinbase.json` for **Coinbase**
- `op.json` for **OP**

These files must be valid JSON and conform to the schema enforced by the app. Required fields and constraints:

- **taskName** (string): Human‑readable task identifier.
- **scriptName** (string): Foundry script to run (e.g., `simulate`).
- **signature** (string): Function signature for the script entrypoint (e.g., `run()` or `run(address,uint256)`).
- **sender** (string): 0x‑prefixed Ethereum address used as the sender for extraction/simulation.
- **args** (string): Optional, arguments for the script signature. No spaces; use commas and/or brackets as needed (e.g., `0xabc...,1` or `[0xabc...,1]`). Use an empty string `""` if none.
- **ledgerId** (number): Non‑negative integer Ledger account index.
- **rpcUrl** (string): HTTPS RPC endpoint to use for simulation.
- **expectedDomainAndMessageHashes** (object):
  - **address** (0x40 hex string)
  - **domainHash** (0x64 hex string)
  - **messageHash** (0x64 hex string)
- **stateOverrides** (array): Each entry:
  - **name** (string)
  - **address** (0x40 hex string)
  - **overrides** (array of objects): each with **key** (0x64), **value** (0x64), **description** (string)
- **stateChanges** (array): Each entry:
  - **name** (string)
  - **address** (0x40 hex string)
  - **changes** (array of objects): each with **key** (0x64), **before** (0x64), **after** (0x64), **description** (string)

Notes:

- Sorting is not required; the tool sorts by address and storage slot for comparison.
- The tool reads `rpcUrl`, `sender`, and `ledgerId` directly from this file.

Minimal example (`validations/base-sc.json`):

```json
{
  "taskName": "mainnet-upgrade-system-config",
  "scriptName": "simulate",
  "signature": "run()",
  "sender": "0x1234567890123456789012345678901234567890",
  "args": "",
  "ledgerId": 0,
  "rpcUrl": "https://mainnet.example.com",
  "expectedDomainAndMessageHashes": {
    "address": "0x9C4a57Feb77e294Fd7BF5EBE9AB01CAA0a90A110",
    "domainHash": "0x88aac3dc27cc1618ec43a87b3df21482acd24d172027ba3fbb5a5e625d895a0b",
    "messageHash": "0x9ef8cce91c002602265fd0d330b1295dc002966e87cd9dc90e2a76efef2517dc"
  },
  "stateOverrides": [
    {
      "name": "Base Multisig",
      "address": "0x9855054731540A48b28990B63DcF4f33d8AE46A1",
      "overrides": [
        {
          "key": "0x0000000000000000000000000000000000000000000000000000000000000004",
          "value": "0x0000000000000000000000000000000000000000000000000000000000000001",
          "description": "Lower threshold for simulation"
        }
      ]
    }
  ],
  "stateChanges": [
    {
      "name": "System Config",
      "address": "0x73a79Fab69143498Ed3712e519A88a918e1f4072",
      "changes": [
        {
          "key": "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
          "before": "0x000000000000000000000000340f923e5c7cbb2171146f64169ec9d5a9ffe647",
          "after": "0x00000000000000000000000078ffe9209dff6fe1c9b6f3efdf996bee60346d0e",
          "description": "Update implementation address"
        }
      ]
    }
  ]
}
```
