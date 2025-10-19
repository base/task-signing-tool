import { StateDiffClient } from '@/lib/state-diff';
import { writeFileSync } from 'fs';
import path from 'path';
import { parse as shellParse } from 'shell-quote';

type CliOptions = {
  rpcUrl: string;
  workdir: string;
  forgeCmd: string;
  out?: string;
  help?: boolean;
};

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

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    rpcUrl: '',
    workdir: '',
    forgeCmd: '',
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--rpc-url':
      case '-r':
        opts.rpcUrl = next() || '';
        break;
      case '--workdir':
      case '-w':
        opts.workdir = next() || '';
        break;
      case '--forge-cmd':
      case '-f':
        opts.forgeCmd = next() || '';
        break;
      case '--out':
      case '-o':
        opts.out = next() || '';
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default: {
        // Support --key=value form
        if (a.startsWith('--')) {
          const [k, v] = a.split('=');
          if (k === '--rpc-url') opts.rpcUrl = v || '';
          else if (k === '--workdir') opts.workdir = v || '';
          else if (k === '--forge-cmd') opts.forgeCmd = v || '';
          else if (k === '--out') opts.out = v || '';
          else if (k === '--help') opts.help = true;
          else {
            console.warn(`Unknown option: ${k}`);
          }
        } else {
          console.warn(`Ignoring positional arg: ${a}`);
        }
      }
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    printUsage();
    return;
  }

  if (!opts.rpcUrl || !opts.workdir || !opts.forgeCmd) {
    console.error('Missing required flags.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const workdir = path.resolve(process.cwd(), opts.workdir);

  const tokens = shellParse(opts.forgeCmd);
  const forgeCmdParts: string[] = tokens.map(t => {
    if (typeof t !== 'string') {
      throw new Error(
        'Unsupported shell token in --forge-cmd. Please provide a simple quoted command string.'
      );
    }
    return t;
  });

  const sdc = new StateDiffClient();
  const { result } = await sdc.simulate(opts.rpcUrl, forgeCmdParts, workdir);

  if (opts.out) {
    const outPath = path.resolve(process.cwd(), opts.out);
    writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
    console.log(`Wrote validation JSON to: ${outPath}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
