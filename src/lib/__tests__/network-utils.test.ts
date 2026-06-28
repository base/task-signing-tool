import { describe, expect, it } from '@jest/globals';
import { formatNetworkName } from '../network-utils';

describe('formatNetworkName', () => {
  it('formats dashed network ids for display', () => {
    expect(formatNetworkName('mainnet')).toBe('Mainnet');
    expect(formatNetworkName('sepolia-alpha')).toBe('Sepolia Alpha');
  });
});
