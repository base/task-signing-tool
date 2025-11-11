import { getAddress } from 'viem';
import { LedgerSigningResult } from './ledger-signing';

function toChecksum(address: string): string {
  try {
    return getAddress(address);
  } catch {
    return address;
  }
}

export function toChecksumAddressSafe(address: string | null | undefined): string {
  return address ? toChecksum(address) : '';
}

// Replace all 0x...40-hex address substrings with checksummed versions
export function checksummizeAddressesInText(text: string | null | undefined): string {
  return text ? text.replace(/0x[a-fA-F0-9]{40}\b/g, toChecksum) : '';
}

export function toDisplaySignature({ data, signer, signature }: LedgerSigningResult): string {
  return `Data: ${data}\nSigner: ${signer}\nSignature: ${signature}`;
}
