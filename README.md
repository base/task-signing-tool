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
- **Script execution**: The tool executes Foundry from the task directory root (`<network>/<task>/`). Ensure your Foundry project or script context is available under that path; the tool will run `forge script` with fields from your validation config (`script_name`, optional `signature` and `args`, and `sender`). Temporary outputs like `temp-script-output.txt` will be written there.
- **Optional README parsing**: If `<network>/<task>/README.md` exists, the tool may parse it to display status and execution links.
