import { promises as fs } from 'fs';
import path from 'path';
import { findContractDeploymentsRoot } from './deployments';
import { getValidationSummary, parseFromString } from './parser';
import { StateDiffClient } from './state-diff';
import {
  BalanceChange,
  NetworkType,
  StateChange,
  StateOverride,
  TaskConfig,
  ValidationData,
} from './types/index';

export type ValidationServiceOpts = {
  upgradeId: string;
  network: NetworkType;
  taskConfigFileName: string;
};

const CONTRACT_DEPLOYMENTS_ROOT = findContractDeploymentsRoot();
const stateDiffClient = new StateDiffClient();

async function getConfigData(
  opts: ValidationServiceOpts
): Promise<{ cfg: TaskConfig; scriptPath: string }> {
  const upgradePath = path.resolve(CONTRACT_DEPLOYMENTS_ROOT, opts.network, opts.upgradeId);

  // Ensure the resolved upgradePath stays within the deployments root to prevent directory traversal
  const normalizedRoot = path.resolve(CONTRACT_DEPLOYMENTS_ROOT) + path.sep;
  if (!upgradePath.startsWith(normalizedRoot)) {
    throw new Error(
      `ValidationService::getConfigData: Invalid upgradeId, resolved path escapes deployments root`
    );
  }

  const configFileName = `${opts.taskConfigFileName}.json`;
  const configPath = path.join(upgradePath, 'validations', configFileName);

  let configContent: string;
  try {
    configContent = await fs.readFile(configPath, 'utf-8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
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
  domainAndMessageHashes?: {
    address: string;
    domainHash: string;
    messageHash: string;
  };
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
  domainAndMessageHashes: {
    address: string;
    domainHash: string;
    messageHash: string;
  };
}> {
  try {
    console.log('Running state-diff simulation...');
    const forgeCmd = cfg.cmd.trim().split(/\s+/);
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
