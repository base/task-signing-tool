import { promises as fs } from 'fs';
import path from 'path';
import { TASK_ORIGIN_COMMON_NAMES, TASK_ORIGIN_SIGNATURE_FILE_NAMES } from './constants';
import { findContractDeploymentsRoot } from './deployments';
import { getValidationSummary, parseFromString } from './parser';
import { StateDiffClient } from './state-diff';
import { verifyTaskOrigin } from './task-origin-validate';
import {
  BalanceChange,
  NetworkType,
  StateChange,
  StateOverride,
  TaskConfig,
  TaskOriginRole,
  TaskOriginValidationConfig,
  ValidationData,
  TaskOriginSignerResult,
  TaskOriginValidation,
} from './types/index';
import { TASK_ORIGIN_ROLE_LABELS } from './validation-results-utils';

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
  const upgradePath = path.join(CONTRACT_DEPLOYMENTS_ROOT, opts.network, opts.upgradeId);
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

async function validateSigner(
  opts: ValidationServiceOpts,
  role: TaskOriginRole,
  commonNameOverride?: string // Only used for taskCreator
): Promise<TaskOriginSignerResult> {
  const networkPath = path.join(CONTRACT_DEPLOYMENTS_ROOT, opts.network);
  const taskFolderPath = path.join(networkPath, opts.upgradeId);

  // Get signatureFileName from constants (hardcoded for all roles)
  const signatureFileName = TASK_ORIGIN_SIGNATURE_FILE_NAMES[role];
  const signatureFile = path.join(networkPath, 'signatures', opts.upgradeId, signatureFileName);

  // Get commonName: from config for taskCreator, from constants for facilitators
  const commonName =
    commonNameOverride ??
    TASK_ORIGIN_COMMON_NAMES[role as keyof typeof TASK_ORIGIN_COMMON_NAMES];

  await verifyTaskOrigin({
    taskFolderPath,
    signatureFile,
    commonName,
    role,
  });

  return {
    role,
    success: true,
  };
}

/**
 * Validates task origin signatures. Aggregates all results and returns instead of throwing.
 */
async function runTaskOriginValidation(
  opts: ValidationServiceOpts,
  config: TaskOriginValidationConfig
): Promise<TaskOriginValidation> {
  const results: TaskOriginSignerResult[] = [];

  // Validate task creator - uses commonName from config
  console.log(`🔐 Validating ${TASK_ORIGIN_ROLE_LABELS.taskCreator} signature...`);
  try {
    results.push(await validateSigner(opts, 'taskCreator', config.taskCreator.commonName));
    console.log(`  ✓ ${TASK_ORIGIN_ROLE_LABELS.taskCreator} signature verified`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`  ✗ ${TASK_ORIGIN_ROLE_LABELS.taskCreator} signature failed: ${message}`);
    results.push({
      role: 'taskCreator',
      success: false,
      error: message,
    });
  }

  // Validate base facilitator
  console.log(`🔐 Validating ${TASK_ORIGIN_ROLE_LABELS.baseFacilitator} signature...`);
  try {
    results.push(await validateSigner(opts, 'baseFacilitator'));
    console.log(`  ✓ ${TASK_ORIGIN_ROLE_LABELS.baseFacilitator} signature verified`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`  ✗ ${TASK_ORIGIN_ROLE_LABELS.baseFacilitator} signature failed: ${message}`);
    results.push({
      role: 'baseFacilitator',
      success: false,
      error: message,
    });
  }

  // Validate security council facilitator
  console.log(`🔐 Validating ${TASK_ORIGIN_ROLE_LABELS.securityCouncilFacilitator} signature...`);
  try {
    results.push(await validateSigner(opts, 'securityCouncilFacilitator'));
    console.log(`  ✓ ${TASK_ORIGIN_ROLE_LABELS.securityCouncilFacilitator} signature verified`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`  ✗ ${TASK_ORIGIN_ROLE_LABELS.securityCouncilFacilitator} signature failed: ${message}`);
    results.push({
      role: 'securityCouncilFacilitator',
      success: false,
      error: message,
    });
  }

  const passedCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  if (passedCount === totalCount) {
    console.log(`✅ Task origin validation completed: ${passedCount}/${totalCount} signatures verified`);
  } else {
    console.log(`⚠️ Task origin validation completed with failures: ${passedCount}/${totalCount} signatures verified`);
  }

  return { enabled: true, results };
}

/**
 * Main validation flow that orchestrates script extraction, simulation, and config parsing.
 */
export async function validateUpgrade(opts: ValidationServiceOpts): Promise<ValidationData> {
  console.log(`🚀 Starting validation for ${opts.upgradeId} on ${opts.network}`);

  const { cfg, scriptPath } = await getConfigData(opts);

  // Determine task origin validation state
  let taskOriginValidation: TaskOriginValidation;
  if (cfg.skipTaskOriginValidation === true) {
    console.log('⚠️ Task origin validation is explicitly skipped in config (acceptable for testnet)');
    taskOriginValidation = { enabled: false, results: [] };
  } else if (!cfg.taskOriginConfig) {
    throw new Error(
      'ValidationService::validateUpgrade: taskOriginConfig is required when task origin validation is enabled. ' +
      'Set skipTaskOriginValidation: true to disable validation (acceptable for testnet environments).'
    );
  } else {
    console.log('🔐 Running task origin validation (must pass before simulation)...');
    taskOriginValidation = await runTaskOriginValidation(opts, cfg.taskOriginConfig);
  }

  // Check if task origin validation failed - if so, skip simulation
  const hasTaskOriginFailure = taskOriginValidation.enabled && 
    taskOriginValidation.results.some(r => !r.success);

  if (hasTaskOriginFailure) {
    console.log('❌ Task origin validation failed - skipping simulation');
    const expected = getExpectedData(cfg);
    return {
      expected,
      actual: {
        stateOverrides: [],
        stateChanges: [],
        balanceChanges: [],
      },
      taskOriginValidation,
    };
  }

  // Run the task simulation
  const expected = getExpectedData(cfg);
  const actual = await runStateDiffSimulation(scriptPath, cfg);

  return {
    expected,
    actual,
    taskOriginValidation,
  };
}
