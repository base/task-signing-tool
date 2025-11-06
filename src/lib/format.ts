import { getAddress, isAddress, keccak256, stringToHex } from 'viem';
import { LedgerSigningResult } from './ledger-signing';

export function toChecksumAddressSafe(address: string | null | undefined): string {
  if (!address) return '';
  try {
    return isAddress(address) ? getAddress(address) : address;
  } catch {
    return address;
  }
}

// Replace all 0x...40-hex address substrings with checksummed versions
export function checksummizeAddressesInText(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/0x[a-fA-F0-9]{40}\b/g, (m: string) => {
    try {
      return isAddress(m) ? getAddress(m) : m;
    } catch {
      return m;
    }
  });
}

export function toDisplaySignature(res: LedgerSigningResult): string {
  return `Data: ${res.data}\nSigner: ${res.signer}\nSignature: ${res.signature}`;
}

export function toChecksumHex(value: string | null | undefined): string {
  if (!value) return '';
  if (typeof value !== 'string') return value as string;
  if (!value.startsWith('0x')) return value;

  const hexBody = value.slice(2);
  if (hexBody.length === 0 || !/^[0-9a-fA-F]+$/.test(hexBody)) {
    return value;
  }

  const lowerCase = hexBody.toLowerCase();
  const hash = keccak256(stringToHex(lowerCase)).slice(2);

  let result = '0x';
  for (let i = 0; i < lowerCase.length; i++) {
    const char = lowerCase[i];
    const hashNibble = parseInt(hash[i] ?? '0', 16);
    if (/[a-f]/.test(char) && hashNibble >= 8) {
      result += char.toUpperCase();
    } else {
      result += char;
    }
  }

  return result;
}
