import { StateDiffClient } from '@/lib/state-diff';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import path from 'path';
import { parseArgs } from 'node:util';
import { parse as shellParse } from 'shell-quote';

function printUsage(): void {
  const msg = `
Generate a validation JSON file from a forge run output.

Usage:
  tsx scripts/genValidationFile.ts --rpc-url <URL> --workdir <DIR> --forge-cmd "<CMD>" [--ledger-id <ID>] [--out <FILE>] [--env-file <FILE>]

Required flags:
  --rpc-url, -r     HTTPS RPC URL used to resolve chainId for decoding
  --workdir, -w     Directory containing stateDiff.json (and where forge will run)
  --forge-cmd, -f   Full forge command to execute (quoted); e.g. "forge script ... --json"

Optional flags:
  --ledger-id, -l    Ledger account index to use in the validation JSON (defaults to 0)
  --out, -o          Output file path for the resulting JSON (defaults to stdout)
  --env-file, -e     Path to .env file to include in validation (defaults to .env in workdir)
  --help, -h         Show this help message

Examples:
  tsx scripts/genValidationFile.ts \
    --rpc-url https://mainnet.example \
    --workdir mainnet/2025-06-04-upgrade-foo \
    --forge-cmd "forge script script/Simulate.s.sol:Simulate --sig 'run()' --sender 0xabc --json" \
    --out mainnet/2025-06-04-upgrade-foo/validations/base-sc.json
`;
  console.log(msg);
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    return {};
  }

  const content = readFileSync(filePath, 'utf-8');
  const envVars: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE format
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      let value = match[2];

      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      envVars[key] = value;
    }
  }

  return envVars;
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'rpc-url': { type: 'string', short: 'r' },
      workdir: { type: 'string', short: 'w' },
      'forge-cmd': { type: 'string', short: 'f' },
      'ledger-id': { type: 'string', short: 'l' },
      out: { type: 'string', short: 'o' },
      'env-file': { type: 'string', short: 'e' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (positionals.length > 0) {
    console.warn(`Ignoring positional args: ${positionals.join(', ')}`);
  }

  if (values.help) {
    printUsage();
    return;
  }

  const rpcUrl = values['rpc-url'] ?? '';
  const workdirFlag = values.workdir ?? '';
  const forgeCmdFlag = values['forge-cmd'] ?? '';
  const ledgerIdFlag = values['ledger-id'];
  const outFlag = values.out;
  const envFileFlag = values['env-file'];

  if (!rpcUrl || !workdirFlag || !forgeCmdFlag) {
    console.error('Missing required flags.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const workdir = path.resolve(process.cwd(), workdirFlag);

  const ledgerId = ledgerIdFlag ? Number.parseInt(ledgerIdFlag, 10) : 0;

  if (!Number.isInteger(ledgerId) || ledgerId < 0) {
    console.error('--ledger-id must be a non-negative integer');
    process.exitCode = 1;
    return;
  }

  // Parse .env file if provided or check default location
  const envFilePath = envFileFlag
    ? path.resolve(process.cwd(), envFileFlag)
    : path.resolve(workdir, '.env');

  const envVars = parseEnvFile(envFilePath);

  if (Object.keys(envVars).length > 0) {
    console.log(`📋 Loaded ${Object.keys(envVars).length} environment variables from ${envFilePath}`);
    console.log(`   Variables: ${Object.keys(envVars).join(', ')}`);
  }

  const tokens = shellParse(forgeCmdFlag);
  const forgeCmdParts: string[] = tokens.map(t => {
    if (typeof t !== 'string') {
      throw new Error(
        'Unsupported shell token in --forge-cmd. Please provide a simple quoted command string.'
      );
    }
    return t;
  });

  // Allow the workdir itself as the root to avoid path traversal errors
  const sdc = new StateDiffClient(ledgerId, workdir);
  const { result } = await sdc.simulate(rpcUrl, forgeCmdParts, workdir);

  // Add envVars to the result if any were found
  // Forge will automatically pick up the .env file in workdir
  const resultWithEnv = Object.keys(envVars).length > 0
    ? { ...result, envVars }
    : result;

  const output = JSON.stringify(resultWithEnv, null, 2);

  if (outFlag) {
    const outPath = path.resolve(process.cwd(), outFlag);
    const outDir = path.dirname(outPath);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, output + '\n');
    console.log(`Wrote validation JSON to: ${outPath}`);
  } else {
    console.log(output);
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
