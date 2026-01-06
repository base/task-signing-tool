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

/**
 * Truncate a string in the middle, preserving start and end characters
 * Useful for displaying long hashes or addresses
 */
export function truncateMiddle(str: string, startChars: number = 6, endChars: number = 4): string {
  if (!str || str.length <= startChars + endChars + 3) {
    return str || '';
  }
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}

/**
 * Format a date string to a human-readable format
 */
export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a timestamp to a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(timestamp: number | Date): string {
  const now = Date.now();
  const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  const diffMs = now - time;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  
  return formatDate(new Date(time).toISOString());
}

/**
 * Format a bytes32 value for display
 */
export function formatBytes32(value: string): string {
  if (!value) return '';
  // Ensure it starts with 0x
  const normalized = value.startsWith('0x') ? value : `0x${value}`;
  return normalized.toLowerCase();
}

/**
 * Format wei to ether with specified decimals
 */
export function formatWeiToEther(wei: bigint | string, decimals: number = 4): string {
  const weiValue = typeof wei === 'string' ? BigInt(wei) : wei;
  const ether = Number(weiValue) / 1e18;
  return ether.toFixed(decimals);
}

/**
 * Validate if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
  try {
    getAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate if a string is a valid bytes32 hash
 */
export function isValidBytes32(hash: string): boolean {
  if (!hash) return false;
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}
