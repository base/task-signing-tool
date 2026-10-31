import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { resetContractDeploymentsRootCacheForTests } from '../deployments';
import { NetworkType } from '../types';

const hashes = {
  address: '0x0000000000000000000000000000000000000001',
  domainHash: '0x' + 'a'.repeat(64),
  messageHash: '0x' + 'b'.repeat(64),
};
const config = {
  cmd: 'forge script Test',
  ledgerId: 7,
  rpcUrl: 'http://localhost:8545',
  expectedDomainAndMessageHashes: hashes,
  stateOverrides: [],
  stateChanges: [],
  skipTaskOriginValidation: true,
};

jest.unstable_mockModule('../state-diff', () => ({
  StateDiffClient: class {
    async simulate() {
      return {
        result: {
          stateOverrides: [],
          stateChanges: [],
          expectedDomainAndMessageHashes: hashes,
        },
      };
    }
  },
}));

describe('validateUpgrade', () => {
  const originalCwd = process.cwd();
  const opts = {
    upgradeId: '2026-01-01-test-upgrade',
    network: NetworkType.Sepolia,
    taskConfigFileName: 'signer',
  };
  let fixtureRoot: string;
  let configPath: string;
  let validateUpgrade: typeof import('../validation-service').validateUpgrade;

  beforeAll(async () => {
    fixtureRoot = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'validation-service-'))
    );
    configPath = path.join(
      fixtureRoot,
      'active/evm/tasks',
      opts.upgradeId,
      'config',
      opts.network,
      'validations/signer.json'
    );
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    process.chdir(fixtureRoot);
    resetContractDeploymentsRootCacheForTests();
    ({ validateUpgrade } = await import('../validation-service'));
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    resetContractDeploymentsRootCacheForTests();
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  it('returns the loaded validation profile ledgerId after simulation', async () => {
    await fs.writeFile(configPath, JSON.stringify(config));

    const result = await validateUpgrade(opts);

    expect(result).toMatchObject({ ledgerId: 7 });
  });

  it('returns the loaded validation profile ledgerId when task origin signatures are missing', async () => {
    await fs.writeFile(
      configPath,
      JSON.stringify({
        ...config,
        skipTaskOriginValidation: false,
        taskOriginConfig: { taskCreator: { commonName: 'test-creator' } },
      })
    );

    const result = await validateUpgrade(opts);

    expect(result.taskOriginValidation).toMatchObject({
      enabled: true,
      results: [
        { role: 'taskCreator', success: false, error: expect.stringContaining('does not exist') },
        {
          role: 'baseFacilitator',
          success: false,
          error: expect.stringContaining('does not exist'),
        },
        {
          role: 'securityCouncilFacilitator',
          success: false,
          error: expect.stringContaining('does not exist'),
        },
      ],
    });
    expect(result).toMatchObject({ ledgerId: 7 });
  });
});
