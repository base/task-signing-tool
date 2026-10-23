import { execFile } from 'child_process';
import { getAddress, keccak256, recoverAddress, type Hex } from 'viem';
import { getEip712SignPath } from './ledger-signing';
import { hashSafeTxTypedData, toEip712Json, type SafeTxTypedData } from './safe-typed-data';
import type { SigningResult } from './types/signing';

export interface TrezorSigningOptions {
  typedData: SafeTxTypedData;
  accountIndex?: number;
}

// Generous: the signer pages through every SafeTx field on the device before confirming.
const SIGN_TIMEOUT_MS = 5 * 60 * 1000;

// First eip712sign release whose `--trezor` signs typed data correctly: v0.0.15 added `--trezor` with
// the message hash shown on the device, but its base/usbwallet sent the domain chainId as 0.
export const MIN_EIP712SIGN_VERSION = 'v0.0.16';

interface RunResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
}

/**
 * Signs a SafeTx on a Trezor with `eip712sign --trezor`, the same binary used for Ledger.
 *
 * The device receives the full typed data, shows each SafeTx field, and asks the signer to confirm
 * the message hash (firmware 2.9.1+). The result is bound to the hashes the signer validated.
 */
export async function signSafeTxWithTrezor(options: TrezorSigningOptions): Promise<SigningResult> {
  const { typedData, accountIndex = 0 } = options;
  const hdPath = `m/44'/60'/${accountIndex}'/0/0`;
  const { domainHash, messageHash } = hashSafeTxTypedData(typedData);
  const dataToSign = `0x1901${domainHash.slice(2)}${messageHash.slice(2)}` as Hex;

  try {
    const result = await runEip712sign([
      '--trezor',
      '--hd-paths',
      hdPath,
      '--data',
      JSON.stringify(toEip712Json(typedData)),
    ]);
    if (!result.success) {
      return {
        success: false,
        error: result.timedOut
          ? 'Timed out waiting for confirmation on the Trezor device'
          : mapTrezorError(result.stderr),
      };
    }

    const parsed = parseEip712signOutput(result.stdout);
    if (!parsed) {
      return {
        success: false,
        error: `Could not extract signature from eip712sign output. Output was: ${result.stdout}`,
      };
    }
    // eip712sign hashes the typed data itself; it must be exactly what was validated.
    if (parsed.data.toLowerCase() !== dataToSign.toLowerCase()) {
      return {
        success: false,
        error: `eip712sign signed ${parsed.data}, expected ${dataToSign}`,
      };
    }

    const recovered = await recoverAddress({
      hash: keccak256(dataToSign),
      signature: parsed.signature,
    });
    if (getAddress(recovered) !== getAddress(parsed.signer)) {
      return {
        success: false,
        error: `Trezor signature recovers to ${recovered}, expected ${parsed.signer}. eip712sign older than ${MIN_EIP712SIGN_VERSION} signs the wrong domain on a Trezor; run \`make deps\` in contract-deployments to update it.`,
      };
    }

    return {
      success: true,
      data: dataToSign,
      signer: getAddress(parsed.signer),
      // Same format as the Ledger path (no 0x prefix).
      signature: parsed.signature.slice(2),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during Trezor signing',
    };
  }
}

function parseEip712signOutput(
  stdout?: string
): { data: Hex; signer: string; signature: Hex } | null {
  const data = stdout?.match(/^Data:\s*(0x1901[a-fA-F0-9]{128})\s*$/m)?.[1];
  const signer = stdout?.match(/^Signer:\s*(0x[a-fA-F0-9]{40})\s*$/m)?.[1];
  const raw = stdout?.match(/^Signature:\s*(?:0x)?([a-fA-F0-9]{130})\s*$/m)?.[1];
  if (!data || !signer || !raw) return null;

  // Safe treats v = 0/1 as other signature types, so normalize device v = 0/1 to ECDSA 27/28.
  const v = parseInt(raw.slice(128), 16);
  const normalizedV = v < 27 ? v + 27 : v;
  if (normalizedV !== 27 && normalizedV !== 28) return null;
  const signature = `0x${raw.slice(0, 128)}${normalizedV.toString(16)}` as Hex;

  return { data: data as Hex, signer, signature };
}

export function mapTrezorError(stderr?: string): string {
  const fallback = 'Unknown error during Trezor signing';
  if (!stderr) return fallback;

  if (/flag provided but not defined: -trezor/i.test(stderr)) {
    return `eip712sign is too old for Trezor. Install ${MIN_EIP712SIGN_VERSION} or newer: run \`make deps\` in contract-deployments, or \`go install github.com/base/eip712sign@${MIN_EIP712SIGN_VERSION}\`.`;
  }
  if (/requires firmware v2\.9\.1/i.test(stderr)) {
    return 'Trezor firmware 2.9.1 or newer is required. Update it in Trezor Suite, then close Trezor Suite and try again.';
  }
  if (/no hardware wallets found|error starting trezor/i.test(stderr)) {
    return 'No Trezor found. Connect and unlock your Trezor, and close Trezor Suite (it holds the device).';
  }
  if (/message hash mismatch/i.test(stderr)) {
    return 'The Trezor computed a different message hash from the one being signed, so it refused to sign. Do not retry: report this with the SafeTx fields the device showed.';
  }
  if (/expected reply types/i.test(stderr)) {
    return 'The Trezor connection is out of sync after a failed attempt. Unplug and reconnect the Trezor, then try again.';
  }
  if (/no such file or directory|ENOENT|command not found/i.test(stderr)) {
    return `eip712sign not found. Run \`make deps\` in contract-deployments, or \`go install github.com/base/eip712sign@${MIN_EIP712SIGN_VERSION}\`.`;
  }
  if (/cancel/i.test(stderr)) {
    return 'Signing was cancelled on the Trezor device';
  }
  if (/LIBUSB_ERROR|access denied|busy|in use/i.test(stderr)) {
    return 'The Trezor is in use by another application. Close Trezor Suite, unplug and reconnect the Trezor, and try again.';
  }

  const trimmed = stderr.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function runEip712sign(args: string[]): Promise<RunResult> {
  return new Promise(resolve => {
    const child = execFile(
      getEip712SignPath(),
      args,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, timeout: SIGN_TIMEOUT_MS },
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
    // Confirmations happen on the device; never wait on host input.
    child.stdin?.end();
  });
}
