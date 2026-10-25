import { jest, it, expect } from '@jest/globals';
import { promisify } from 'util';

const mockExecFile = jest
  .fn<(command: string, args: string[], options: unknown) => Promise<{ stdout: string }>>()
  .mockResolvedValue({ stdout: '' });
Object.assign(mockExecFile, { [promisify.custom]: mockExecFile });

jest.unstable_mockModule('child_process', () => ({ execFile: mockExecFile }));

const { signDomainAndMessageHash } = await import('../ledger-signing');

it('signs the exact domain and message hashes with the selected Ledger account path', async () => {
  const domain = '11'.repeat(32);
  const message = '22'.repeat(32);

  await signDomainAndMessageHash({
    domainHash: '0x' + domain,
    messageHash: '0x' + message,
    ledgerAccount: 3,
  });

  expect(mockExecFile.mock.calls[0][1].slice(0, 5)).toEqual([
    '--ledger',
    '--hd-paths',
    "m/44'/60'/3'/0/0",
    '--data',
    '0x1901' + domain + message,
  ]);
});
