import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import * as os from 'os';
import { join } from 'path';
import { keccak256, serializeSignature, type Hex } from 'viem';
import { privateKeyToAccount, sign } from 'viem/accounts';
import type { SafeTxTypedData } from '../safe-typed-data';

type ExecCallback = (
  error: (Error & { killed?: boolean }) | null,
  stdout: string,
  stderr: string
) => void;

let nextResult: { error: (Error & { killed?: boolean }) | null; stdout: string; stderr: string };
let lastArgs: string[] = [];
let lastOpts: { env?: NodeJS.ProcessEnv } = {};
let lastTypedDataJson: unknown;

// Isolate from the machine: no mise or trezorctl unless a test installs a fake one.
const fakeHome = mkdtempSync(join(os.tmpdir(), 'trezor-home-'));
process.env.PATH = '';

function installFake(name: string): string {
  const dir = join(fakeHome, '.local', 'bin');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, '');
  chmodSync(file, 0o755);
  return file;
}

const mockExecFile = jest.fn(
  (_cmd: string, args: string[], opts: { env?: NodeJS.ProcessEnv }, cb: ExecCallback) => {
    lastArgs = args;
    lastOpts = opts;
    const file = args[args.length - 1];
    if (file.endsWith('.json')) lastTypedDataJson = JSON.parse(readFileSync(file, 'utf8'));
    setImmediate(() => cb(nextResult.error, nextResult.stdout, nextResult.stderr));
    return { stdin: { end: jest.fn() } };
  }
);

jest.unstable_mockModule('child_process', () => ({ execFile: mockExecFile }));
jest.unstable_mockModule('os', () => ({ ...os, homedir: () => fakeHome }));

const {
  signSafeTxWithTrezor,
  mapTrezorError,
  ensureTrezorctl,
  getTrezorctlCommand,
  TREZOR_PACKAGE_VERSION,
  UV_VERSION,
} = await import('../trezor-signing');
const { hashSafeTxTypedData } = await import('../safe-typed-data');

const PRIVATE_KEY = ('0x' + '11'.repeat(32)) as Hex;
const account = privateKeyToAccount(PRIVATE_KEY);
const ZERO = '0x0000000000000000000000000000000000000000';

const typedData: SafeTxTypedData = {
  domain: { chainId: '8453', verifyingContract: '0x9855054731540A48b28990B63DcF4f33d8AE46A1' },
  message: {
    to: '0xcA11bde05977b3631167028862bE2a173976CA11',
    value: '0',
    data: '0x1234',
    operation: 1,
    safeTxGas: '0',
    baseGas: '0',
    gasPrice: '0',
    gasToken: ZERO,
    refundReceiver: ZERO,
    nonce: '7',
  },
};

async function deviceSignature(): Promise<{ data: Hex; signature: Hex }> {
  const { domainHash, messageHash } = hashSafeTxTypedData(typedData);
  const data = `0x1901${domainHash.slice(2)}${messageHash.slice(2)}` as Hex;
  const signature = serializeSignature(
    await sign({ hash: keccak256(data), privateKey: PRIVATE_KEY })
  );
  return { data, signature };
}

describe('signSafeTxWithTrezor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    lastTypedDataJson = undefined;
  });

  it('signs via trezorctl and returns eip712sign-compatible output', async () => {
    const { data, signature } = await deviceSignature();
    nextResult = {
      error: null,
      stdout: JSON.stringify({ address: account.address, signature }),
      stderr: '',
    };

    const res = await signSafeTxWithTrezor({ typedData, accountIndex: 3 });

    expect(res).toEqual({
      success: true,
      data,
      signer: account.address,
      signature: signature.slice(2),
    });
    expect(lastArgs.slice(0, 5)).toEqual([
      '--json',
      'ethereum',
      'sign-typed-data',
      '-n',
      "m/44'/60'/3'/0/0",
    ]);
    expect(lastTypedDataJson).toMatchObject({
      primaryType: 'SafeTx',
      domain: typedData.domain,
      message: typedData.message,
    });
  });

  it('rejects a signature that does not recover to the reported address', async () => {
    const { signature } = await deviceSignature();
    nextResult = {
      error: null,
      stdout: JSON.stringify({ address: '0x' + '2'.repeat(40), signature }),
      stderr: '',
    };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/recovers to/);
  });

  it('rejects signatures with v = 0/1', async () => {
    const { signature } = await deviceSignature();
    const v = signature.slice(-2) === '1b' ? '00' : '01';
    nextResult = {
      error: null,
      stdout: JSON.stringify({ address: account.address, signature: signature.slice(0, -2) + v }),
      stderr: '',
    };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Could not parse trezorctl output/);
  });

  it('fails on unparseable output', async () => {
    nextResult = { error: null, stdout: 'address: 0xabc', stderr: '' };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Could not parse trezorctl output/);
  });

  it('maps device errors', async () => {
    nextResult = {
      error: new Error('exit 1'),
      stdout: '',
      stderr: 'Error: Action cancelled by user',
    };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res).toEqual({ success: false, error: 'Signing was cancelled on the Trezor device' });
  });

  it('reports timeouts', async () => {
    const err = Object.assign(new Error('killed'), { killed: true });
    nextResult = { error: err, stdout: '', stderr: '' };
    const res = await signSafeTxWithTrezor({ typedData });
    expect(res.error).toMatch(/Timed out/);
  });
});

describe('ensureTrezorctl', () => {
  it('returns null when trezorctl runs', async () => {
    nextResult = { error: null, stdout: 'trezorctl, version 0.20.2', stderr: '' };
    expect(await ensureTrezorctl()).toBeNull();
    expect(lastArgs.slice(-1)).toEqual(['--version']);
    expect(lastOpts.env?.MISE_YES).toBe('1');
  });

  it('returns the mapped error when trezorctl is missing', async () => {
    nextResult = { error: new Error('spawn trezorctl ENOENT'), stdout: '', stderr: '' };
    expect(await ensureTrezorctl()).toMatch(/trezorctl not found.*pipx install trezor/);
  });

  it('reports a timed-out install', async () => {
    const err = Object.assign(new Error('killed'), { killed: true });
    nextResult = { error: err, stdout: '', stderr: '' };
    expect(await ensureTrezorctl()).toMatch(/Timed out installing trezorctl/);
  });
});

describe('getTrezorctlCommand', () => {
  it('falls back to trezorctl on PATH without mise', () => {
    expect(getTrezorctlCommand()).toEqual({ file: 'trezorctl', prefix: [] });
  });

  it('prefers the pinned version through mise', () => {
    const trezorctl = installFake('trezorctl');
    expect(getTrezorctlCommand()).toEqual({ file: trezorctl, prefix: [] });

    const mise = installFake('mise');
    expect(getTrezorctlCommand()).toEqual({
      file: mise,
      prefix: [
        'exec',
        `uv@${UV_VERSION}`,
        `pipx:trezor@${TREZOR_PACKAGE_VERSION}`,
        '--',
        'trezorctl',
      ],
    });
  });
});

describe('mapTrezorError', () => {
  it.each([
    ['spawn trezorctl ENOENT', /trezorctl not found/],
    ['mise WARN  GitHub rate limit exceeded', /GITHUB_TOKEN/],
    ['mise ERROR failed to install aqua:astral-sh/uv@0.13.1', /Installing trezorctl failed/],
    ['No Trezor found', /No Trezor found/],
    ['LIBUSB_ERROR_ACCESS', /Close Trezor Suite/],
    ['Aborted!', /passphrase/],
    ['Failure_UnexpectedMessage', /firmware/],
    ['something else', /something else/],
  ])('%s', (stderr, expected) => {
    expect(mapTrezorError(stderr)).toMatch(expected);
  });
});
