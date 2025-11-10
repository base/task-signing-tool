import { StateDiffClient } from '@/lib/state-diff';
import { writeFileSync } from 'fs';
import path from 'path';
import { parseArgs } from 'node:util';
import { parse as shellParse } from 'shell-quote';

function printUsage(): void {
  const msg = `
Generate a validation JSON file from a forge run output.

Usage:
  tsx scripts/genValidationFile.ts --rpc-url <URL> --workdir <DIR> --forge-cmd "<CMD>" [--out <FILE>]

Required flags:
  --rpc-url, -r     HTTPS RPC URL used to resolve chainId for decoding
  --workdir, -w     Directory containing stateDiff.json (and where forge will run)
  --forge-cmd, -f   Full forge command to execute (quoted); e.g. "forge script ... --json"

Optional flags:
  --out, -o         Output file path for the resulting JSON (defaults to stdout)
  --help, -h        Show this help message

Examples:
  tsx scripts/genValidationFile.ts \
    --rpc-url https://mainnet.example \
    --workdir mainnet/2025-06-04-upgrade-foo \
    --forge-cmd "forge script script/Simulate.s.sol:Simulate --sig 'run()' --sender 0xabc --json" \
    --out mainnet/2025-06-04-upgrade-foo/validations/base-sc.json
`;
  console.log(msg);
}

async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'rpc-url': { type: 'string', short: 'r' },
      workdir: { type: 'string', short: 'w' },
      'forge-cmd': { type: 'string', short: 'f' },
      out: { type: 'string', short: 'o' },
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
  const outFlag = values.out;

  if (!rpcUrl || !workdirFlag || !forgeCmdFlag) {
    console.error('Missing required flags.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const workdir = path.resolve(process.cwd(), workdirFlag);

  const tokens = shellParse(forgeCmdFlag);
  const forgeCmdParts: string[] = tokens.map(t => {
    if (typeof t !== 'string') {
      throw new Error(
        'Unsupported shell token in --forge-cmd. Please provide a simple quoted command string.'
      );
    }
    return t;
  });

  const sdc = new StateDiffClient();
  const { result } = await sdc.simulate(rpcUrl, forgeCmdParts, workdir);

  const output = JSON.stringify(result, null, 2);

  if (outFlag) {
    const outPath = path.resolve(process.cwd(), outFlag);
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
