/**
 * Test suite for format utility functions
 */

import {
  toChecksumAddressSafe,
  checksummizeAddressesInText,
  truncateMiddle,
  formatDate,
  formatBytes32,
  formatWeiToEther,
  isValidAddress,
  isValidBytes32,
} from '../lib/format';

describe('Format Utilities', () => {
  describe('toChecksumAddressSafe', () => {
    it('should convert lowercase address to checksum format', () => {
      const address = '0x9855054731540a48b28990b63dcf4f33d8ae46a1';
      const result = toChecksumAddressSafe(address);
      expect(result).toBe('0x9855054731540A48b28990B63DcF4f33d8AE46A1');
    });

    it('should return empty string for null input', () => {
      expect(toChecksumAddressSafe(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(toChecksumAddressSafe(undefined)).toBe('');
    });

    it('should handle already checksummed address', () => {
      const address = '0x9855054731540A48b28990B63DcF4f33d8AE46A1';
      expect(toChecksumAddressSafe(address)).toBe(address);
    });

    it('should return original for invalid address', () => {
      const invalid = '0xinvalid';
      expect(toChecksumAddressSafe(invalid)).toBe(invalid);
    });
  });

  describe('checksummizeAddressesInText', () => {
    it('should checksum all addresses in text', () => {
      const text = 'Contract at 0x9855054731540a48b28990b63dcf4f33d8ae46a1 deployed';
      const result = checksummizeAddressesInText(text);
      expect(result).toContain('0x9855054731540A48b28990B63DcF4f33d8AE46A1');
    });

    it('should handle multiple addresses', () => {
      const text = 'From 0x9855054731540a48b28990b63dcf4f33d8ae46a1 to 0x73a79fab69143498ed3712e519a88a918e1f4072';
      const result = checksummizeAddressesInText(text);
      expect(result).toContain('0x9855054731540A48b28990B63DcF4f33d8AE46A1');
      expect(result).toContain('0x73a79Fab69143498Ed3712e519A88a918e1f4072');
    });

    it('should return empty string for null input', () => {
      expect(checksummizeAddressesInText(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(checksummizeAddressesInText(undefined)).toBe('');
    });
  });

  describe('truncateMiddle', () => {
    it('should truncate long strings', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = truncateMiddle(hash, 6, 4);
      expect(result).toBe('0x1234...cdef');
    });

    it('should not truncate short strings', () => {
      const short = '0x1234';
      expect(truncateMiddle(short, 6, 4)).toBe('0x1234');
    });

    it('should return empty string for empty input', () => {
      expect(truncateMiddle('')).toBe('');
    });

    it('should use default values', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = truncateMiddle(hash);
      expect(result).toBe('0x1234...cdef');
    });
  });

  describe('formatDate', () => {
    it('should format valid date string', () => {
      const result = formatDate('2025-01-06');
      expect(result).toMatch(/Jan\s+6,\s+2025/);
    });

    it('should return original for invalid date', () => {
      expect(formatDate('invalid-date')).toBe('invalid-date');
    });

    it('should handle ISO date format', () => {
      const result = formatDate('2025-12-25T10:30:00Z');
      expect(result).toMatch(/Dec\s+25,\s+2025/);
    });
  });

  describe('formatBytes32', () => {
    it('should normalize bytes32 to lowercase with 0x prefix', () => {
      const value = '0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';
      const result = formatBytes32(value);
      expect(result).toBe(value.toLowerCase());
    });

    it('should add 0x prefix if missing', () => {
      const value = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = formatBytes32(value);
      expect(result.startsWith('0x')).toBe(true);
    });

    it('should return empty string for empty input', () => {
      expect(formatBytes32('')).toBe('');
    });
  });

  describe('formatWeiToEther', () => {
    it('should convert wei to ether', () => {
      const wei = BigInt('1000000000000000000');
      const result = formatWeiToEther(wei);
      expect(result).toBe('1.0000');
    });

    it('should handle string input', () => {
      const result = formatWeiToEther('2500000000000000000');
      expect(result).toBe('2.5000');
    });

    it('should respect decimal places', () => {
      const wei = BigInt('1234567890000000000');
      const result = formatWeiToEther(wei, 2);
      expect(result).toBe('1.23');
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid address', () => {
      expect(isValidAddress('0x9855054731540A48b28990B63DcF4f33d8AE46A1')).toBe(true);
    });

    it('should return true for lowercase valid address', () => {
      expect(isValidAddress('0x9855054731540a48b28990b63dcf4f33d8ae46a1')).toBe(true);
    });

    it('should return false for invalid address', () => {
      expect(isValidAddress('0xinvalid')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidAddress('')).toBe(false);
    });

    it('should return false for short address', () => {
      expect(isValidAddress('0x1234')).toBe(false);
    });
  });

  describe('isValidBytes32', () => {
    it('should return true for valid bytes32', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      expect(isValidBytes32(hash)).toBe(true);
    });

    it('should return false for invalid bytes32', () => {
      expect(isValidBytes32('0x1234')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidBytes32('')).toBe(false);
    });

    it('should return false for invalid hex characters', () => {
      const invalid = '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG';
      expect(isValidBytes32(invalid)).toBe(false);
    });
  });
});
