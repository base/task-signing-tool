import { StateDiffClient } from '@/lib/state-diff';
import { L2GasEstimator } from '@/lib/l2-gas-estimator';
import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { parseArgs } from 'node:util';
import { parse as shellParse } from 'shell-quote';

function printUsage(): void {
  const msg = `
Generate a validation JSON file from a forge run output.

Usage:
  tsx scripts/genValidationFile.ts --rpc-url <URL> --workdir <DIR> --forge-cmd "<CMD>" [--ledger-id <ID>] [--out <FILE>]

Required flags:
  --rpc-url, -r     HTTPS RPC URL used to resolve chainId for decoding
  --workdir, -w     Directory containing stateDiff.json (and where forge will run)
  --forge-cmd, -f   Full forge command to execute (quoted); e.g. "forge script ... --json"

Optional flags:
  --ledger-id, -l      Ledger account index to use in the validation JSON (defaults to 0)
  --out, -o            Output file path for the resulting JSON (defaults to stdout)
  --estimate-l2-gas    Enable L2 gas estimation (only use for depositTransaction calls)
  --l2-rpc-url <url>   L2 RPC URL for gas estimation (required with --estimate-l2-gas)
  --l2-gas-buffer      Buffer percentage to add to estimated L2 gas (defaults to 20)
  --help, -h           Show this help message

Examples:
  # Basic validation file generation
  tsx scripts/genValidationFile.ts \
    --rpc-url https://mainnet.example \
    --workdir mainnet/2025-06-04-upgrade-foo \
    --forge-cmd "forge script script/Simulate.s.sol:Simulate --sig 'run()' --sender 0xabc --json" \
    --out mainnet/2025-06-04-upgrade-foo/validations/base-sc.json

  # With L2 gas estimation for deposit transactions
  tsx scripts/genValidationFile.ts \
    --rpc-url https://mainnet.example \
    --workdir mainnet/2025-06-04-my-l2-deposit \
    --forge-cmd "forge script script/MyDeposit.s.sol:MyDeposit --sig 'run()' --sender 0xabc --json" \
    --estimate-l2-gas \
    --l2-rpc-url https://base-mainnet.example \
    --l2-gas-buffer 25 \
    --out validations/base-sc.json
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
      'ledger-id': { type: 'string', short: 'l' },
      out: { type: 'string', short: 'o' },
      'estimate-l2-gas': { type: 'boolean' },
      'l2-rpc-url': { type: 'string' },
      'l2-gas-buffer': { type: 'string' },
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
  const estimateL2Gas = values['estimate-l2-gas'] ?? false;
  const l2RpcUrl = values['l2-rpc-url'];
  const l2GasBufferFlag = values['l2-gas-buffer'];

  if (!rpcUrl || !workdirFlag || !forgeCmdFlag) {
    console.error('Missing required flags.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (estimateL2Gas && !l2RpcUrl) {
    console.error('--l2-rpc-url is required when using --estimate-l2-gas');
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

  const tokens = shellParse(forgeCmdFlag);
  const forgeCmdParts: string[] = tokens.map(t => {
    if (typeof t !== 'string') {
      throw new Error(
        'Unsupported shell token in --forge-cmd. Please provide a simple quoted command string.'
      );
    }
    return t;
  });

  const sdc = new StateDiffClient(ledgerId, workdir);
  const { result, transactionTo, transactionData } = await sdc.simulate(rpcUrl, forgeCmdParts, workdir);

  // Optionally estimate L2 gas for deposit transactions
  let resultWithL2Gas = result;
  if (estimateL2Gas && l2RpcUrl) {
    console.log('\n📊 L2 Gas Estimation enabled');

    const l2GasBuffer = l2GasBufferFlag ? Number.parseInt(l2GasBufferFlag, 10) : 20;

    if (!Number.isInteger(l2GasBuffer) || l2GasBuffer < 0 || l2GasBuffer > 100) {
      console.error('--l2-gas-buffer must be an integer between 0 and 100');
      process.exitCode = 1;
      return;
    }

    try {
      const estimator = new L2GasEstimator();

      // Decode the deposit transaction
      const deposit = estimator.decodeDepositTransaction(transactionData);
      console.log(`   L2 Target: ${deposit.to}`);
      console.log(`   L2 Value: ${deposit.value}`);
      console.log(`   L2 Data length: ${deposit.data.length} chars`);

      // Estimate L2 gas using viem
      const gasUsed = await estimator.estimateL2Gas(l2RpcUrl, deposit);

      const recommendedGasLimit = (gasUsed * BigInt(100 + l2GasBuffer)) / BigInt(100);

      console.log(`\n✅ L2 Gas Estimation Complete:`);
      console.log(`   Estimated gas: ${gasUsed}`);
      console.log(`   Buffer: ${l2GasBuffer}%`);
      console.log(`   Recommended L2_GAS_LIMIT: ${recommendedGasLimit}`);

      resultWithL2Gas = {
        ...result,
        l2GasEstimation: {
          estimatedGas: gasUsed.toString(),
          buffer: l2GasBuffer,
          recommendedGasLimit: recommendedGasLimit.toString(),
        },
      };
    } catch (error) {
      console.error('❌ L2 gas estimation failed:', error);
      console.log('⚠️  Continuing without L2 gas estimation');
    }
  }

  const output = JSON.stringify(resultWithL2Gas, null, 2);

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
