import { getAddress, isAddress } from 'viem';

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

export function stripHexPrefix(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/^0x/i, '');
}
