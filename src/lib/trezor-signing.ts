import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { getAddress, keccak256, recoverAddress, type Hex } from 'viem';
import { hashSafeTxTypedData, toEip712Json, type SafeTxTypedData } from './safe-typed-data';
import type { SigningResult } from './types/signing';

export interface TrezorSigningOptions {
  typedData: SafeTxTypedData;
  accountIndex?: number;
}

// Generous: the signer pages through every SafeTx field on the device before confirming.
const SIGN_TIMEOUT_MS = 5 * 60 * 1000;

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

export async function checkTrezorctlAvailability(): Promise<boolean> {
  try {
    return (await runTrezorctl(['--version'], 30_000)).success;
  } catch {
    return false;
  }
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

  if (/ENOENT|command not found/i.test(stderr)) {
    return 'trezorctl not found. Install it with `pipx install trezor` and ensure it is on your PATH.';
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
  return new Promise(resolve => {
    const child = execFile(
      getTrezorctlPath(),
      args,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout },
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

function getTrezorctlPath(): string {
  // pipx installs to ~/.local/bin, which is often missing from the server's PATH.
  const pipxPath = join(homedir(), '.local', 'bin', 'trezorctl');
  return existsSync(pipxPath) ? pipxPath : 'trezorctl';
}
