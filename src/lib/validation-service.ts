import fs from 'fs';
import path from 'path';
import { ConfigParser } from './parser';
import { StateDiffClient } from './state-diff';
import { NetworkType, StateChange, StateOverride, TaskConfig, ValidationData } from './types/index';

type BaseOptions = {
  upgradeId: string;
  network: NetworkType;
  userType: string;
};

export class ValidationService {
  private stateDiffClient?: StateDiffClient;

  constructor() {
    this.stateDiffClient = new StateDiffClient();
  }

  private async getConfigData(
    baseOptions: BaseOptions
  ): Promise<{ cfg: TaskConfig; scriptPath: string }> {
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
      return { cfg: parsedConfig.config, scriptPath: upgradePath };
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
    const { cfg, scriptPath } = await this.getConfigData(baseOptions);

    // 2. Get expected data from parsed config
    const expected = this.getExpectedData(cfg);

    // 3. Get actual data by running scripts and simulation
    const actual = await this.runStateDiffSimulation(scriptPath, cfg);

    return { expected, actual };
  }

  private getExpectedData(parsedConfig: TaskConfig): {
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    domainAndMessageHashes?: {
      address: string;
      domainHash: string;
      messageHash: string;
    };
  } {
    return {
      stateOverrides: parsedConfig.stateOverrides,
      stateChanges: parsedConfig.stateChanges,
      domainAndMessageHashes: parsedConfig.expectedDomainAndMessageHashes,
    };
  }

  /**
   * Run simulation using state-diff tool
   */
  private async runStateDiffSimulation(
    scriptPath: string,
    cfg: TaskConfig
  ): Promise<{
    stateOverrides: StateOverride[];
    stateChanges: StateChange[];
    domainAndMessageHashes: {
      address: string;
      domainHash: string;
      messageHash: string;
    };
  }> {
    if (!this.stateDiffClient) {
      throw new Error(
        'ValidationService::runStateDiffSimulation: StateDiffClient not initialized.'
      );
    }

    try {
      console.log('Running state-diff simulation...');
      const forgeCmd = cfg.cmd.split(' ');
      const stateDiffResult = await this.stateDiffClient.simulate(cfg.rpcUrl, forgeCmd, scriptPath);

      console.log(
        `✅ State-diff simulation completed: ${stateDiffResult.result.stateOverrides.length} state overrides, ${stateDiffResult.result.stateChanges.length} state changes found`
      );

      return {
        stateOverrides: stateDiffResult.result.stateOverrides,
        stateChanges: stateDiffResult.result.stateChanges,
        domainAndMessageHashes: stateDiffResult.result.expectedDomainAndMessageHashes,
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
    console.log('getConfigFileName input:', userType);
    const fileName = userType.toLowerCase().replace(/\s+/g, '-') + '.json';
    console.log(`🗂️ Mapping user type "${userType}" to config file: ${fileName}`);
    return fileName;
  }
}
