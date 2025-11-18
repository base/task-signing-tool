import { execFile } from 'child_process';
import { promisify } from 'util';

export interface LedgerSigningOptions {
  domainHash: string;
  messageHash: string;
  hdPath?: string;
  ledgerAccount?: number;
}

export interface LedgerSigningResult {
  success: boolean;
  data?: string;
  signature?: string;
  signer?: string;
  error?: string;
}

interface ExecFileError extends Error {
  code?: number | string;
  stdout?: string;
  stderr?: string;
}

const execFileAsync = promisify(execFile);

interface RunEip712signResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
}

export async function signDomainAndMessageHash(
  options: LedgerSigningOptions
): Promise<LedgerSigningResult> {
  const { domainHash, messageHash, ledgerAccount = 0 } = options;
  const hdPath = options.hdPath || `m/44'/60'/${ledgerAccount}'/0/0`;

  try {
    validateHash('domain hash', domainHash);
    validateHash('message hash', messageHash);

    const dataToSign = `0x1901${domainHash.slice(2)}${messageHash.slice(2)}`;

    const result = await runEip712sign(['--ledger', '--hd-paths', hdPath, '--data', dataToSign]);

    if (result.success) {
      const parsed = parseSignatureOutput(result.stdout);

      if (parsed) {
        return {
          success: true,
          data: dataToSign,
          signer: parsed.signer,
          signature: parsed.signature,
        };
      }

      return {
        success: false,
        error: `Could not extract signature from eip712sign output. Output was: ${result.stdout}`,
      };
    }

    const errorMessage = mapLedgerError(result.stderr);

    return {
      success: false,
      error: errorMessage,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during Ledger signing',
    };
  }
}

export async function checkLedgerAvailability(): Promise<boolean> {
  try {
    const result = await runEip712sign(['--help']);
    return result.success;
  } catch {
    return false;
  }
}

function validateHash(name: string, value: string) {
  if (!value.startsWith('0x') || value.length !== 66) {
    throw new Error(`LedgerSigningLib::signDomainAndMessageHash: Invalid ${name} format`);
  }
}

function parseSignatureOutput(output?: string) {
  if (!output) {
    return null;
  }

  const signatureMatch = output.match(/Signature:\s*(0x[a-fA-F0-9]{130}|[a-fA-F0-9]{130})/);
  const signerMatch = output.match(/Signer:\s*(0x[a-fA-F0-9]{40})/);

  if (!signatureMatch || !signerMatch) {
    return null;
  }

  const signature = signatureMatch[1];

  return {
    signature,
    signer: signerMatch[1],
  };
}

function mapLedgerError(stderr?: string) {
  const fallback = 'Unknown error during Ledger signing';

  if (!stderr) {
    return fallback;
  }

  if (/reply lacks public key entry/i.test(stderr)) {
    return 'Please unlock your Ledger device and open the Ethereum app';
  }

  if (/no such file or directory/i.test(stderr) || /not found/i.test(stderr)) {
    return 'eip712sign binary not found. Please ensure it is installed and in your PATH or GOPATH/bin.';
  }

  if (/user denied/i.test(stderr)) {
    return 'Transaction was denied on the Ledger device';
  }

  const trimmed = stderr.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

async function runEip712sign(args: string[]): Promise<RunEip712signResult> {
  try {
    const { stdout } = await execFileAsync('eip712sign', args, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    return {
      success: true,
      stdout,
    };
  } catch (error) {
    if (isExecFileError(error)) {
      const stderr = typeof error.stderr === 'string' ? error.stderr : undefined;

      return {
        success: false,
        stderr: stderr ?? error.message,
      };
    }

    throw error;
  }
}

function isExecFileError(error: unknown): error is ExecFileError {
  return (
    error instanceof Error &&
    (Object.prototype.hasOwnProperty.call(error, 'stderr') ||
      Object.prototype.hasOwnProperty.call(error, 'stdout') ||
      Object.prototype.hasOwnProperty.call(error, 'code'))
  );
}
