import path from 'path';
import { TASK_ORIGIN_COMMON_NAMES, TASK_ORIGIN_SIGNATURE_FILE_NAMES } from './constants';
import { defaultTaskCatalog } from './task-catalog';
import type { SafeTxTypedData } from './safe-typed-data';
import { StateDiffClient } from './state-diff';
import { verifyTaskOrigin } from './task-origin-validate';
import {
  BalanceChange,
  ExpectedHashes,
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

function getExpectedData(parsedConfig: TaskConfig): {
  stateOverrides: StateOverride[];
  stateChanges: StateChange[];
  balanceChanges: BalanceChange[];
  domainAndMessageHashes: ExpectedHashes;
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
  cfg: TaskConfig,
  stateDiffClient: StateDiffClient
): Promise<{
  stateOverrides: StateOverride[];
  stateChanges: StateChange[];
  balanceChanges: BalanceChange[];
  domainAndMessageHashes: ExpectedHashes;
  safeTxTypedData?: SafeTxTypedData;
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
      safeTxTypedData: stateDiffResult.safeTxTypedData,
    };
  } catch (error) {
    console.error('❌ State-diff simulation failed:', error);
    throw error;
  }
}

async function validateSigner(
  taskOriginDir: string,
  signatureDir: string,
  role: TaskOriginRole,
  allowedDir: string,
  commonNameOverride?: string // Only used for taskCreator
): Promise<TaskOriginSignerResult> {
  // Get signatureFileName from constants (hardcoded for all roles)
  const signatureFileName = TASK_ORIGIN_SIGNATURE_FILE_NAMES[role];
  const signatureFile = path.join(signatureDir, signatureFileName);

  // Get commonName: from config for taskCreator, from constants for facilitators
  const commonName =
    commonNameOverride ?? TASK_ORIGIN_COMMON_NAMES[role as keyof typeof TASK_ORIGIN_COMMON_NAMES];

  await verifyTaskOrigin({
    taskFolderPath: taskOriginDir,
    signatureFile,
    commonName,
    role,
    allowedDir,
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
  taskOriginDir: string,
  signatureDir: string,
  config: TaskOriginValidationConfig,
  allowedDir: string
): Promise<TaskOriginValidation> {
  const results: TaskOriginSignerResult[] = [];

  for (const [role, commonName] of [
    ['taskCreator', config.taskCreator.commonName],
    ['baseFacilitator'],
    ['securityCouncilFacilitator'],
  ] as const) {
    const label = TASK_ORIGIN_ROLE_LABELS[role];
    console.log(`🔐 Validating ${label} signature...`);
    try {
      results.push(await validateSigner(taskOriginDir, signatureDir, role, allowedDir, commonName));
      console.log(`  ✓ ${label} signature verified`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ✗ ${label} signature failed: ${message}`);
      results.push({
        role,
        success: false,
        error: message,
      });
    }
  }

  const passedCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  if (passedCount === totalCount) {
    console.log(
      `✅ Task origin validation completed: ${passedCount}/${totalCount} signatures verified`
    );
  } else {
    console.log(
      `⚠️ Task origin validation completed with failures: ${passedCount}/${totalCount} signatures verified`
    );
  }

  return { enabled: true, results };
}

/**
 * Main validation flow that orchestrates script extraction, simulation, and config parsing.
 */
export async function validateUpgrade(opts: ValidationServiceOpts): Promise<ValidationData> {
  console.log(`🚀 Starting validation for ${opts.upgradeId} on ${opts.network}`);

  const catalog = defaultTaskCatalog();
  const cfg = catalog.loadProfile(opts.upgradeId, opts.network, opts.taskConfigFileName);
  const { evmDir, taskOriginDir, signaturesDir } = catalog.taskDirs(opts.upgradeId, opts.network);
  const stateDiffClient = new StateDiffClient(0, catalog.root);

  // Determine task origin validation state
  let taskOriginValidation: TaskOriginValidation;
  if (cfg.skipTaskOriginValidation === true) {
    console.log(
      '⚠️ Task origin validation is explicitly skipped in config (acceptable for testnet)'
    );
    taskOriginValidation = {
      enabled: false,
      results: [],
      hidden: cfg.hideTaskOriginSkippedPage === true,
    };
  } else if (!cfg.taskOriginConfig) {
    throw new Error(
      'ValidationService::validateUpgrade: taskOriginConfig is required when task origin validation is enabled. ' +
        'Set skipTaskOriginValidation: true to disable validation (acceptable for testnet environments).'
    );
  } else {
    console.log('🔐 Running task origin validation (must pass before simulation)...');
    taskOriginValidation = await runTaskOriginValidation(
      taskOriginDir,
      signaturesDir,
      cfg.taskOriginConfig,
      catalog.root
    );
  }

  // Check if task origin validation failed - if so, skip simulation
  const hasTaskOriginFailure =
    taskOriginValidation.enabled && taskOriginValidation.results.some(r => !r.success);

  if (hasTaskOriginFailure) {
    console.log('❌ Task origin validation failed - skipping simulation');
    const expected = getExpectedData(cfg);
    return {
      ledgerId: cfg.ledgerId,
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
  const actual = await runStateDiffSimulation(evmDir, cfg, stateDiffClient);

  return {
    ledgerId: cfg.ledgerId,
    expected,
    actual,
    taskOriginValidation,
  };
}
