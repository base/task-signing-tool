import { ExtractedData, ScriptRunnerOptions, SimulationLink } from './types/index';

import { spawn } from 'child_process';
import fs from 'fs';

/**
 * Run a Foundry script and extract structured data from its output
 */
export async function runAndExtract(options: ScriptRunnerOptions): Promise<ExtractedData> {
  const {
    scriptPath,
    rpcUrl,
    scriptName,
    signature,
    args = [],
    sender,
    saveOutput,
    extractOnly = false,
  } = options;

  console.log('🔧 Foundry Script Runner & Data Extractor\n');

  let scriptOutput: string;

  if (extractOnly && saveOutput && fs.existsSync(saveOutput)) {
    console.log(`📁 Reading existing output from: ${saveOutput}`);
    scriptOutput = fs.readFileSync(saveOutput, 'utf8');
  } else {
    // Build and run the forge command
    const forgeArgs = buildForgeArgs({ rpcUrl, scriptName, signature, args, sender });

    console.log(`📍 Working directory: ${scriptPath}`);
    console.log(`🚀 Running: ${formatCommandForDisplay('forge', forgeArgs)}\n`);

    if (!fs.existsSync(scriptPath)) {
      throw new Error(
        `ScriptExtractorLib::runAndExtract: Script directory does not exist: ${scriptPath}`
      );
    }

    // Stream output in real-time while accumulating for later parsing
    const { stdout, stderr } = await new Promise<{
      stdout: string;
      stderr: string;
    }>((resolve, reject) => {
      const child = spawn('forge', forgeArgs, {
        cwd: scriptPath,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let out = '';
      let err = '';

      child.stdout.on('data', chunk => {
        const text = chunk.toString();
        out += text;
        process.stdout.write(text);
      });

      child.stderr.on('data', chunk => {
        const text = chunk.toString();
        err += text;
        process.stderr.write(text);
      });

      child.on('error', error => {
        reject(
          new Error(`ScriptExtractorLib::runAndExtract: Script execution failed: ${error.message}`)
        );
      });

      child.on('close', code => {
        if (code !== 0) {
          reject(
            new Error(
              `ScriptExtractorLib::runAndExtract: Script execution closed with nonzero exit code: ${
                err || `Exit code ${code}`
              }`
            )
          );
          return;
        }
        resolve({ stdout: out, stderr: err });
      });
    });

    if (stderr) {
      console.error(stderr);
      throw new Error(`ScriptExtractorLib::runAndExtract: script execution failed: ${stderr}`);
    }

    scriptOutput = stdout || '';

    console.log('✅ Script executed successfully!\n');

    // Optionally save output to file
    if (saveOutput) {
      fs.writeFileSync(saveOutput, scriptOutput);
      console.log(`💾 Output saved to: ${saveOutput}\n`);
    }
  }

  // Extract and display results
  console.log('🔍 Extracting structured data...\n');

  try {
    const extractedData = extractFromOutput(scriptOutput);
    displayResults(extractedData);

    // Optionally save extracted data as JSON
    if (saveOutput) {
      const jsonFile = saveOutput.replace(/\.[^/.]+$/, '') + '-extracted.json';
      fs.writeFileSync(jsonFile, JSON.stringify(extractedData, null, 2));
      console.log(`📄 Extracted data saved to: ${jsonFile}\n`);
    }

    return extractedData;
  } catch (error) {
    console.error('❌ Failed to extract data:', error);
    console.log('\n📝 Raw script output:');
    console.log('-'.repeat(50));
    console.log(scriptOutput);

    // Throw error instead of exiting the process
    throw new Error(
      `ScriptExtractorLib::runAndExtract: Data extraction failed: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

/**
 * Extract structured data from Foundry script output
 */
function extractFromOutput(output: string): ExtractedData {
  // Regex patterns for extraction (single matches only, except nested hashes)
  const PATTERNS = {
    nestedHash: /Nested hash for safe (0x[a-fA-F0-9]{40}):\s*(0x[a-fA-F0-9]{64})/g,
    simulationLink: /https:\/\/dashboard\.tenderly\.co\/[^\s]+/,
    approvalHash:
      /call Safe\.approveHash on (0x[a-fA-F0-9]{40}) with the following hash:\s*(0x[a-fA-F0-9]{64})/,
    signingData: /Data to sign:\s*vvvvvvvv\s*(0x[a-fA-F0-9]+)\s*\^\^\^\^\^\^\^\^/,
    rawInputData: /Insert the following hex into the 'Raw input data' field:\s*(0x[a-fA-F0-9]+)/,
  } as const;

  const simulationMatch = output.match(PATTERNS.simulationLink);
  const approvalHashMatch = output.match(PATTERNS.approvalHash);
  const signingDataMatch = output.match(PATTERNS.signingData);
  const rawInputDataMatch = output.match(PATTERNS.rawInputData);

  // Extract multiple nested hashes
  const nestedHashes = [];
  let nestedHashMatch;
  while ((nestedHashMatch = PATTERNS.nestedHash.exec(output)) !== null) {
    nestedHashes.push({
      safeAddress: nestedHashMatch[1],
      hash: nestedHashMatch[2],
    });
  }

  // Other data types only contain one match each
  const simulationLink = simulationMatch
    ? parseSimulationUrl(simulationMatch[0], rawInputDataMatch ? rawInputDataMatch[1] : undefined)
    : null;

  const approvalHash = approvalHashMatch
    ? {
        safeAddress: approvalHashMatch[1],
        hash: approvalHashMatch[2],
      }
    : null;

  const signingData = signingDataMatch
    ? {
        dataToSign: signingDataMatch[1],
      }
    : null;

  return {
    nestedHashes,
    simulationLink: simulationLink ?? undefined,
    approvalHash: approvalHash ?? undefined,
    signingData: signingData ?? undefined,
  };
}

/**
 * Parse simulation URL and extract parameters
 */
function parseSimulationUrl(url: string, separateRawInput?: string): SimulationLink {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    return {
      url,
      network: params.get('network') || 'unknown',
      contractAddress:
        params.get('contractAddress') || '0x0000000000000000000000000000000000000000',
      from: params.get('from') || '0x0000000000000000000000000000000000000000',
      stateOverrides: params.get('stateOverrides') || undefined,
      // Use separate raw input if available, otherwise use URL parameter
      rawFunctionInput: separateRawInput || params.get('rawFunctionInput') || undefined,
    };
  } catch {
    return {
      url,
      network: 'unknown',
      contractAddress: '0x0000000000000000000000000000000000000000',
      from: '0x0000000000000000000000000000000000000000',
      rawFunctionInput: separateRawInput || undefined,
    };
  }
}

/**
 * Build the forge script arguments
 */
function buildForgeArgs(options: {
  rpcUrl: string;
  scriptName: string;
  signature?: string;
  args?: string[];
  sender?: string;
}): string[] {
  const { rpcUrl, scriptName, signature, args = [], sender } = options;

  const forgeArgs: string[] = ['script', '--rpc-url', rpcUrl, scriptName];

  if (signature) {
    forgeArgs.push('--sig', signature);
    for (const arg of args) {
      forgeArgs.push(arg);
    }
  }

  if (sender) {
    forgeArgs.push('--sender', sender);
  }

  return forgeArgs;
}

/**
 * Format a command and argv for display/logging only
 */
function formatCommandForDisplay(command: string, argv: string[]): string {
  return [command, ...argv].join(' ');
}

/**
 * Utils: Display extracted results
 */
function displayResults(data: ExtractedData) {
  // Display detailed data
  if (data.nestedHashes.length > 0) {
    console.log('🔗 NESTED HASHES:');
    console.log('='.repeat(50));
    data.nestedHashes.forEach((hash, i) => {
      console.log(`${i + 1}. Safe: ${hash.safeAddress}`);
      console.log(`   Hash: ${hash.hash}`);
    });
    console.log('');
  }

  if (data.simulationLink) {
    console.log('🌐 SIMULATION LINK:');
    console.log('='.repeat(50));
    console.log(`URL: ${data.simulationLink.url}`);
    console.log('');
    console.log('URL Breakdown:');
    console.log('='.repeat(50));
    console.log(`• Network: ${data.simulationLink.network}`);
    console.log(`• Contract: ${data.simulationLink.contractAddress}`);
    console.log(`• From: ${data.simulationLink.from}`);

    // Display break down of URL components
    if (data.simulationLink.stateOverrides) {
      try {
        // Decode URL-encoded JSON and parse it
        const decodedStateOverrides = decodeURIComponent(data.simulationLink.stateOverrides);
        const parsedOverrides: Array<{
          contractAddress: string;
          storage?: Array<{ key: string; value: string }>;
        }> = JSON.parse(decodedStateOverrides);

        console.log(`• State Overrides:`);
        parsedOverrides.forEach((override, index) => {
          console.log(`  ${index + 1}. Contract: `);
          console.log(`     Name: (empty)`); // Leave empty as requested
          console.log(`     Address: ${override.contractAddress}`);
          console.log(`     Storage Overrides:`);
          override.storage?.forEach((storage, storageIndex) => {
            console.log(`       ${storageIndex + 1}. Key: ${storage.key}`);
            console.log(`          Value: ${storage.value}`);
          });
        });
      } catch (error) {
        // If parsing fails, show raw data
        console.error(error);
        console.log(`• State Overrides (raw): ${data.simulationLink.stateOverrides}`);
      }
    }
    if (data.simulationLink.rawFunctionInput) {
      console.log(`• Raw Function Input:`);
      console.log(`  ${data.simulationLink.rawFunctionInput}`);
    }
    console.log('');
  }

  if (data.approvalHash) {
    console.log('✅ APPROVAL HASH:');
    console.log('='.repeat(50));
    console.log(`Safe: ${data.approvalHash.safeAddress}`);
    console.log(`Hash: ${data.approvalHash.hash}`);
    console.log('');
  }

  if (data.signingData) {
    console.log('✏️  SIGNING DATA:');
    console.log('='.repeat(50));
    console.log(`Data to Sign: ${data.signingData.dataToSign}`);
    console.log('');
  }
}
