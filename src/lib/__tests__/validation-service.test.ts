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

  it('verifies all task origin signatures with their role identities', async () => {
    const signedOpts = { ...opts, upgradeId: '2026-01-01-signed-upgrade' };
    const taskPath = path.join(fixtureRoot, 'active/evm/tasks', signedOpts.upgradeId);
    const networkConfigDir = path.join(taskPath, 'config', signedOpts.network);
    const fixturesDir = path.join(originalCwd, '__tests__/fixtures');
    await fs.cp(path.join(fixturesDir, 'valid-task/config/chain1'), networkConfigDir, {
      recursive: true,
    });
    await fs.cp(
      path.join(fixturesDir, 'signatures/valid'),
      path.join(taskPath, 'signatures', signedOpts.network),
      { recursive: true }
    );
    const profilePath = path.join(fixtureRoot, 'signed-profile.json');
    await fs.writeFile(
      profilePath,
      JSON.stringify({
        ...config,
        skipTaskOriginValidation: false,
        taskOriginConfig: { taskCreator: { commonName: 'alexis.williams.1@coinbase.com' } },
      })
    );
    await fs.mkdir(path.join(networkConfigDir, 'validations'));
    // Symlinks are excluded from the signed tarball; keep the profile inside the allowed root.
    await fs.symlink(profilePath, path.join(networkConfigDir, 'validations/signer.json'));

    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const result = await validateUpgrade(signedOpts);

      expect(result.taskOriginValidation).toEqual({
        enabled: true,
        results: [
          { role: 'taskCreator', success: true },
          { role: 'baseFacilitator', success: true },
          { role: 'securityCouncilFacilitator', success: true },
        ],
      });
      expect(log).toHaveBeenCalledWith('  ✓ Task Creator signature verified');
      expect(log).toHaveBeenCalledWith('  ✓ Base Facilitator signature verified');
      expect(log).toHaveBeenCalledWith('  ✓ Security Council Facilitator signature verified');
    } finally {
      log.mockRestore();
    }
  });
});
