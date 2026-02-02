import { promises as fs } from 'fs';
import path from 'path';
import { findContractDeploymentsRoot } from './deployments';
import { getValidationSummary, parseFromString } from './parser';
import { StateDiffClient } from './state-diff';
import {
  BalanceChange,
  ExpectedHashes,
  NetworkType,
  StateChange,
  StateOverride,
  TaskConfig,
  ValidationData,
} from './types/index';

function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const content = require('fs').readFileSync(filePath, 'utf-8');
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
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        envVars[key] = value;
      }
    }

    return envVars;
  } catch (error) {
    return {};
  }
}

function verifyEnvVars(
  expected: Record<string, string> | undefined,
  scriptPath: string
): { valid: boolean; errors: string[]; actualEnvVars: Record<string, string> } {
  const envFilePath = path.join(scriptPath, '.env');
  const actualEnvVars = parseEnvFile(envFilePath);
  const errors: string[] = [];

  // If no env vars expected, .env file must be empty or missing
  if (!expected || Object.keys(expected).length === 0) {
    if (Object.keys(actualEnvVars).length > 0) {
      errors.push(
        `❌ Validation file specifies no environment variables, but .env contains:\n` +
          `   ${Object.keys(actualEnvVars).join(', ')}\n` +
          `   Please remove the .env file or ensure it only contains the required variables.`
      );
    }
    return {
      valid: errors.length === 0,
      errors,
      actualEnvVars,
    };
  }

  // Check that all expected env vars are present and match
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (!(key in actualEnvVars)) {
      errors.push(`❌ Missing required environment variable: ${key}`);
    } else if (actualEnvVars[key] !== expectedValue) {
      errors.push(
        `❌ Environment variable mismatch for ${key}:\n` +
          `   Expected: ${expectedValue}\n` +
          `   Actual:   ${actualEnvVars[key]}`
      );
    }
  }

  // Fail if there are extra env vars not in the validation file
  for (const key of Object.keys(actualEnvVars)) {
    if (!(key in expected)) {
      errors.push(
        `❌ Unexpected environment variable found: ${key}\n` +
          `   This variable is not in the validation file.\n` +
          `   The .env file must ONLY contain variables listed in the validation file.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    actualEnvVars,
  };
}

export type ValidationServiceOpts = {
  upgradeId: string;
  network: NetworkType;
  taskConfigFileName: string;
};

const CONTRACT_DEPLOYMENTS_ROOT = findContractDeploymentsRoot();
const stateDiffClient = new StateDiffClient(0, CONTRACT_DEPLOYMENTS_ROOT);

async function getConfigData(
  opts: ValidationServiceOpts
): Promise<{ cfg: TaskConfig; scriptPath: string }> {
  const upgradePath = path.join(CONTRACT_DEPLOYMENTS_ROOT, opts.network, opts.upgradeId);
  const configFileName = `${opts.taskConfigFileName}.json`;
  const configPath = path.join(upgradePath, 'validations', configFileName);

  let configContent: string;
  try {
    configContent = await fs.readFile(configPath, 'utf-8');
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`ValidationService::getConfigData: Config file not found: ${configPath}`);
    }
    console.error(`❌ Error reading config file: ${error}`);
    throw error;
  }

  const parsedConfig = parseFromString(configContent);

  if (!parsedConfig.result.success) {
    console.error('❌ Failed to parse config:', getValidationSummary(parsedConfig.result));
    throw new Error('ValidationService::getConfigData: Failed to parse config file');
  }

  if (!('config' in parsedConfig)) {
    throw new Error('ValidationService::getConfigData: Parsed config missing config data');
  }

  console.log(`✅ Loaded config data from ${configFileName}`);
  return { cfg: parsedConfig.config, scriptPath: upgradePath };
}

function getExpectedData(parsedConfig: TaskConfig): {
  stateOverrides: StateOverride[];
  stateChanges: StateChange[];
  balanceChanges: BalanceChange[];
  domainAndMessageHashes?: ExpectedHashes;
} {
  return {
    stateOverrides: parsedConfig.stateOverrides,
    stateChanges: parsedConfig.stateChanges,
    balanceChanges: parsedConfig.balanceChanges ?? [],
    domainAndMessageHashes: parsedConfig.expectedDomainAndMessageHashes,
  };
}

async function runStateDiffSimulation(
  scriptPath: string,
  cfg: TaskConfig
): Promise<{
  stateOverrides: StateOverride[];
  stateChanges: StateChange[];
  balanceChanges: BalanceChange[];
  domainAndMessageHashes: ExpectedHashes;
}> {
  try {
    // Verify environment variables if present in validation config
    if (cfg.envVars && Object.keys(cfg.envVars).length > 0) {
      console.log(
        `🔍 Verifying ${Object.keys(cfg.envVars).length} required environment variables...`
      );
      const envVerification = verifyEnvVars(cfg.envVars, scriptPath);

      if (!envVerification.valid) {
        const errorMsg =
          '❌ Environment variable verification failed:\n' + envVerification.errors.join('\n');
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('✅ All required environment variables verified');
    }

    console.log('Running state-diff simulation...');
    const forgeCmd = cfg.cmd.trim().split(/\s+/);
    // Forge will automatically pick up .env file in scriptPath
    // We've already verified it matches the expected values above
    const stateDiffResult = await stateDiffClient.simulate(cfg.rpcUrl, forgeCmd, scriptPath);

    console.log(
      `✅ State-diff simulation completed: ${
        stateDiffResult.result.stateOverrides.length
      } state overrides, ${stateDiffResult.result.stateChanges.length} state changes, ${
        stateDiffResult.result.balanceChanges?.length ?? 0
      } balance changes found`
    );

    return {
      stateOverrides: stateDiffResult.result.stateOverrides,
      stateChanges: stateDiffResult.result.stateChanges,
      balanceChanges: stateDiffResult.result.balanceChanges ?? [],
      domainAndMessageHashes: stateDiffResult.result.expectedDomainAndMessageHashes,
    };
  } catch (error) {
    console.error('❌ State-diff simulation failed:', error);
    throw error;
  }
}

/**
 * Main validation flow that orchestrates script extraction, simulation, and config parsing
 */
export async function validateUpgrade(opts: ValidationServiceOpts): Promise<ValidationData> {
  console.log(`🚀 Starting validation for ${opts.upgradeId} on ${opts.network}`);

  const { cfg, scriptPath } = await getConfigData(opts);
  const expected = getExpectedData(cfg);
  const actual = await runStateDiffSimulation(scriptPath, cfg);

  return { expected, actual };
}
