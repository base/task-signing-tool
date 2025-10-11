import fs from 'fs';
import path from 'path';
import { ConfigParser } from './parser';
import { StateDiffClient } from './state-diff';
import { NetworkType, StateChange, StateOverride, TaskConfig, ValidationData } from './types/index';

export interface ValidationOptions {
  upgradeId: string; // e.g., "2025-06-04-upgrade-system-config"
  network: NetworkType;
  userType: 'Base SC' | 'Coinbase' | 'OP';
  rpcUrl: string;
  sender: string;
  stateDiffBinaryPath?: string;
}

type BaseOptions = {
  upgradeId: string;
  network: NetworkType;
  userType: string;
  stateDiffBinaryPath?: string;
};

export class ValidationService {
  private stateDiffClient?: StateDiffClient;

  constructor(stateDiffBinaryPath?: string) {
    this.stateDiffClient = new StateDiffClient(stateDiffBinaryPath);
  }

  /**
   * Parse validation config file and return both ValidationOptions and parsed config
   */
  private async getConfigData(baseOptions: BaseOptions): Promise<{
    options: ValidationOptions;
    parsedConfig: TaskConfig;
  }> {
    const contractDeploymentsPath = path.join(process.cwd(), '..');

    const upgradePath = path.join(
      contractDeploymentsPath,
      baseOptions.network,
      baseOptions.upgradeId
    );

    // Look for validation config files based on user type in validations subdirectory
    const configFileName = this.getConfigFileName(baseOptions.userType);
    const configPath = path.join(upgradePath, 'validations', configFileName);

    if (!fs.existsSync(configPath)) {
      throw new Error(`ValidationService::getConfigData: Config file not found: ${configPath}`);
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = ConfigParser.parseFromString(configContent);

      if (!parsedConfig.result.success) {
        console.error(
          '❌ Failed to parse config:',
          ConfigParser.getValidationSummary(parsedConfig.result)
        );
        throw new Error('ValidationService::getConfigData: Failed to parse config file');
      }

      console.log(`✅ Loaded config data from ${configFileName}`);

      // Return complete ValidationOptions with rpcUrl from config and the parsed config
      return {
        options: {
          upgradeId: baseOptions.upgradeId,
          network: baseOptions.network as NetworkType,
          userType: baseOptions.userType as 'Base SC' | 'Coinbase' | 'OP',
          rpcUrl: parsedConfig.config.rpc_url,
          sender: parsedConfig.config.sender,
          stateDiffBinaryPath: baseOptions.stateDiffBinaryPath,
        },
        parsedConfig: parsedConfig.config,
      };
    } catch (error) {
      console.error(`❌ Error reading config file: ${error}`);
      throw error;
    }
  }

  /**
   * Main validation flow that orchestrates script extraction, simulation, and config parsing
   */
  async validateUpgrade(baseOptions: BaseOptions): Promise<ValidationData> {
    console.log(`🚀 Starting validation for ${baseOptions.upgradeId} on ${baseOptions.network}`);

    // 1. Get complete config data including rpcUrl from validation file
    const { options, parsedConfig } = await this.getConfigData(baseOptions);

    // 2. Get expected data from parsed config
    const expected = this.getExpectedData(parsedConfig);

    // 3. Get actual data by running scripts and simulation
    const actual = await this.runStateDiffSimulation(options, expected.scriptParams);

    // 4. Sort state overrides and changes for consistent comparison
    const sortedExpectedData = this.sortValidationData({
      stateOverrides: expected.stateOverrides,
      stateChanges: expected.stateChanges,
    });
    const sortedActualData = this.sortValidationData(actual.data);

    const sortedExpected = {
      ...sortedExpectedData,
      domainAndMessageHashes: expected.domainAndMessageHashes,
    };
    const sortedActual = sortedActualData;

    console.log(
      `📊 Sorted data for comparison: ${sortedExpected.stateChanges.length} state changes, ${sortedExpected.stateOverrides.length} state overrides`
    );

    return {
      expected: sortedExpected,
      actual: sortedActual,
      stateDiffOutput: actual.stateDiffOutput,
    };
  }

  /**
   * Sort validation data for consistent comparison
   * Sorts by contract address first, then by storage slot (key)
   */
  private sortValidationData(data: {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
  }): {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
  } {
    // Sort state overrides by address only (storage slots sorted within each contract)
    const sortedStateOverrides = [...data.stateOverrides]
      .sort((a, b) => {
        // Sort by contract address (case-insensitive)
        return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
      })
      .map(stateOverride => ({
        ...stateOverride,
        // Sort overrides within each contract by storage slot (key)
        overrides: [...stateOverride.overrides].sort((a, b) =>
          a.key.toLowerCase().localeCompare(b.key.toLowerCase())
        ),
      }));

    // Sort state changes by address only (storage slots sorted within each contract)
    const sortedStateChanges = [...data.stateChanges]
      .sort((a, b) => {
        // Sort by contract address (case-insensitive)
        return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
      })
      .map(stateChange => ({
        ...stateChange,
        // Sort changes within each contract by storage slot (key)
        changes: [...stateChange.changes].sort((a, b) =>
          a.key.toLowerCase().localeCompare(b.key.toLowerCase())
        ),
      }));

    return {
      stateOverrides: sortedStateOverrides,
      stateChanges: sortedStateChanges,
    };
  }

  private getExpectedData(parsedConfig: TaskConfig): {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    domainAndMessageHashes?: {
      address: string;
      domain_hash: string;
      message_hash: string;
    };
    ledgerId: number;
    scriptParams: {
      scriptName: string;
      signature: string;
      args: string;
    };
  } {
    return {
      stateOverrides: parsedConfig.state_overrides,
      stateChanges: parsedConfig.state_changes,
      domainAndMessageHashes: parsedConfig.expected_domain_and_message_hashes,
      ledgerId: parsedConfig['ledger-id'],
      scriptParams: {
        scriptName: parsedConfig.script_name,
        signature: parsedConfig.signature,
        args: parsedConfig.args,
      },
    };
  }

  /**
   * Run simulation using state-diff tool
   */
  private async runStateDiffSimulation(
    options: ValidationOptions,
    scriptParams: {
      scriptName: string;
      signature: string;
      args: string;
    }
  ): Promise<{
    data: {
      stateOverrides: StateOverride[];
      stateChanges: StateChange[];
    };
    stateDiffOutput?: string;
  }> {
    if (!this.stateDiffClient) {
      throw new Error(
        'ValidationService::runStateDiffSimulation: StateDiffClient not initialized.'
      );
    }

    try {
      console.log('🔧 Running state-diff simulation with extracted data...');
      const contractDeploymentsPath = path.join(process.cwd(), '..');
      const scriptPath = path.join(contractDeploymentsPath, options.network, options.upgradeId);
      const opts = {
        scriptPath,
        rpcUrl: options.rpcUrl,
        scriptName: scriptParams.scriptName,
        signature: scriptParams.signature,
        args: scriptParams.args ? [scriptParams.args] : [], // Handle empty args
        sender: options.sender,
        saveOutput: path.join(scriptPath, 'temp-script-output.txt'),
      };
      const forgeArgs = this.buildForgeArgs({
        rpcUrl: opts.rpcUrl,
        scriptName: opts.scriptName,
        signature: opts.signature,
        args: opts.args,
        sender: opts.sender,
      });
      const forgeCmdParts = ['forge', ...forgeArgs];
      const stateDiffResult = await this.stateDiffClient.simulate(
        options.rpcUrl,
        forgeCmdParts,
        scriptPath
      );

      // Parse both state overrides and state changes from state-diff output
      const stateOverrides = this.stateDiffClient.parseStateOverrides(stateDiffResult.result);
      const stateChanges = this.stateDiffClient.parseStateChanges(stateDiffResult.result);

      console.log(
        `✅ State-diff simulation completed: ${stateOverrides.length} state overrides, ${stateChanges.length} state changes found`
      );

      return {
        data: { stateOverrides, stateChanges },
        stateDiffOutput: stateDiffResult.output,
      };
    } catch (error) {
      console.error('❌ State-diff simulation failed:', error);
      throw error;
    }
  }

  /**
   * Get config file name based on user type (now supports dynamic user types)
   */
  private getConfigFileName(userType: string): string {
    // Convert display name back to filename
    // "Base Sc" → "base-sc.json"
    // "Op" → "op.json"
    // "Coinbase" → "coinbase.json"
    const fileName = userType.toLowerCase().replace(/\s+/g, '-') + '.json';
    console.log(`🗂️ Mapping user type "${userType}" to config file: ${fileName}`);
    return fileName;
  }

  private buildForgeArgs(options: {
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
}
