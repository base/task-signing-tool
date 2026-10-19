import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { delimiter, join } from 'path';
import { getAddress, keccak256, recoverAddress, type Hex } from 'viem';
import { hashSafeTxTypedData, toEip712Json, type SafeTxTypedData } from './safe-typed-data';
import type { SigningResult } from './types/signing';

export interface TrezorSigningOptions {
  typedData: SafeTxTypedData;
  accountIndex?: number;
}

// Generous: the signer pages through every SafeTx field on the device before confirming.
const SIGN_TIMEOUT_MS = 5 * 60 * 1000;

// Pinned trezorctl, installed through mise on first use. uv lets mise install the PyPI package and
// fetches its own Python, so signers need nothing beyond the mise that contract-deployments installs.
export const TREZOR_PACKAGE_VERSION = '0.20.2';
export const UV_VERSION = '0.13.1';
// The first run downloads uv, Python and trezor.
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

const MANUAL_INSTALL_HINT =
  'Install mise (https://mise.jdx.dev) so the tool can install trezorctl itself, or install it with `pipx install trezor`.';

interface RunResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
}

export async function signSafeTxWithTrezor(options: TrezorSigningOptions): Promise<SigningResult> {
  const { typedData, accountIndex = 0 } = options;
  const hdPath = `m/44'/60'/${accountIndex}'/0/0`;
  const { domainHash, messageHash } = hashSafeTxTypedData(typedData);
  const dataToSign = `0x1901${domainHash.slice(2)}${messageHash.slice(2)}` as Hex;

  const dir = await mkdtemp(join(tmpdir(), 'trezor-sign-'));
  try {
    const file = join(dir, 'typed-data.json');
    await writeFile(file, JSON.stringify(toEip712Json(typedData)), { mode: 0o600 });

    const result = await runTrezorctl(
      ['--json', 'ethereum', 'sign-typed-data', '-n', hdPath, file],
      SIGN_TIMEOUT_MS
    );
    if (!result.success) {
      return {
        success: false,
        error: result.timedOut
          ? 'Timed out waiting for confirmation on the Trezor device'
          : mapTrezorError(result.stderr),
      };
    }

    const parsed = parseTrezorOutput(result.stdout);
    if (!parsed) {
      return {
        success: false,
        error: `Could not parse trezorctl output. Output was: ${result.stdout}`,
      };
    }

    // Bind the device signature to the hashes the signer validated.
    const recovered = await recoverAddress({
      hash: keccak256(dataToSign),
      signature: parsed.signature,
    });
    if (getAddress(recovered) !== getAddress(parsed.address)) {
      return {
        success: false,
        error: `Trezor signature recovers to ${recovered}, expected ${parsed.address}`,
      };
    }

    return {
      success: true,
      data: dataToSign,
      signer: getAddress(parsed.address),
      // Match eip712sign output (no 0x prefix) so downstream signature collection is unchanged.
      signature: parsed.signature.slice(2),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during Trezor signing',
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Makes sure trezorctl runs, installing the pinned version through mise on first use.
 * Returns null when ready, otherwise an error message for the signer.
 */
export async function ensureTrezorctl(): Promise<string | null> {
  const result = await runTrezorctl(['--version'], INSTALL_TIMEOUT_MS);
  if (result.success) return null;
  return result.timedOut
    ? 'Timed out installing trezorctl. Check your network connection and try again.'
    : mapTrezorError(result.stderr);
}

function parseTrezorOutput(stdout?: string): { address: string; signature: Hex } | null {
  try {
    const out = JSON.parse(stdout ?? '') as { address?: unknown; signature?: unknown };
    if (
      typeof out.address === 'string' &&
      /^0x[a-fA-F0-9]{40}$/.test(out.address) &&
      typeof out.signature === 'string' &&
      // Safe treats v = 0/1 as other signature types; only accept ECDSA v = 27/28.
      /^0x[a-fA-F0-9]{128}(1b|1c)$/i.test(out.signature)
    ) {
      return { address: out.address, signature: out.signature as Hex };
    }
  } catch {
    // fall through
  }
  return null;
}

export function mapTrezorError(stderr?: string): string {
  const fallback = 'Unknown error during Trezor signing';
  if (!stderr) return fallback;

  if (/rate limit|403 Forbidden/i.test(stderr)) {
    return 'Installing trezorctl hit the GitHub API rate limit. Run `export GITHUB_TOKEN=$(gh auth token)` before `make sign-task`, or install it with `pipx install trezor`.';
  }
  if (/failed to install/i.test(stderr)) {
    return `Installing trezorctl failed. ${MANUAL_INSTALL_HINT}\n${stderr.trim()}`;
  }
  if (/ENOENT|command not found/i.test(stderr)) {
    return `trezorctl not found. ${MANUAL_INSTALL_HINT}`;
  }
  if (/no trezor|device not found|no device/i.test(stderr)) {
    return 'No Trezor found. Connect and unlock your Trezor.';
  }
  if (/busy|LIBUSB_ERROR_ACCESS|claim|in use/i.test(stderr)) {
    return 'The Trezor is in use by another application. Close Trezor Suite and try again.';
  }
  if (/cancel/i.test(stderr)) {
    return 'Signing was cancelled on the Trezor device';
  }
  if (/passphrase|aborted/i.test(stderr)) {
    return 'Trezor requested input on the host (e.g. a passphrase). Enter it on the device or disable passphrase protection for this wallet.';
  }
  if (/UnexpectedMessage/i.test(stderr)) {
    return 'The Trezor rejected the request. Update the device firmware and try again.';
  }

  const trimmed = stderr.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function runTrezorctl(args: string[], timeout: number): Promise<RunResult> {
  const { file, prefix } = getTrezorctlCommand();
  return new Promise(resolve => {
    const child = execFile(
      file,
      [...prefix, ...args],
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout,
        // Never stop at a mise confirmation prompt; there is no terminal.
        env: { ...process.env, MISE_YES: '1' },
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ success: true, stdout });
          return;
        }
        resolve({
          success: false,
          stdout,
          stderr: stderr || error.message,
          timedOut: error.killed === true,
        });
      }
    );
    // trezorctl never gets interactive host input: PIN and confirmations happen on the device.
    child.stdin?.end();
  });
}

export function getTrezorctlCommand(): { file: string; prefix: string[] } {
  const mise = findOnPath('mise', [join(homedir(), '.local', 'bin', 'mise')]);
  if (mise) {
    return {
      file: mise,
      prefix: [
        'exec',
        `uv@${UV_VERSION}`,
        `pipx:trezor@${TREZOR_PACKAGE_VERSION}`,
        '--',
        'trezorctl',
      ],
    };
  }
  // Without mise, use a manual install. pipx puts it in ~/.local/bin, often missing from the server's PATH.
  return {
    file: findOnPath('trezorctl', [join(homedir(), '.local', 'bin', 'trezorctl')]) ?? 'trezorctl',
    prefix: [],
  };
}

function findOnPath(name: string, preferred: string[]): string | null {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  return [...preferred, ...dirs.map(dir => join(dir, name))].find(p => existsSync(p)) ?? null;
}
