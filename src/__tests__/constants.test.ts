/**
 * Test suite for constants and network utilities
 */

import {
  availableNetworks,
  DEFAULT_RPC_URLS,
  BLOCK_EXPLORER_URLS,
  getTransactionExplorerUrl,
  getAddressExplorerUrl,
} from '../lib/constants';

import {
  NetworkType,
  NETWORK_CHAIN_IDS,
  CHAIN_ID_TO_NETWORK,
  getNetworkDisplayName,
  isTestnet,
} from '../lib/types';

describe('Constants and Network Utilities', () => {
  describe('availableNetworks', () => {
    it('should include all four networks', () => {
      expect(availableNetworks).toHaveLength(4);
      expect(availableNetworks).toContain(NetworkType.Mainnet);
      expect(availableNetworks).toContain(NetworkType.Sepolia);
      expect(availableNetworks).toContain(NetworkType.BaseMainnet);
      expect(availableNetworks).toContain(NetworkType.BaseSepolia);
    });
  });

  describe('NETWORK_CHAIN_IDS', () => {
    it('should have correct chain IDs', () => {
      expect(NETWORK_CHAIN_IDS[NetworkType.Mainnet]).toBe(1);
      expect(NETWORK_CHAIN_IDS[NetworkType.Sepolia]).toBe(11155111);
      expect(NETWORK_CHAIN_IDS[NetworkType.BaseMainnet]).toBe(8453);
      expect(NETWORK_CHAIN_IDS[NetworkType.BaseSepolia]).toBe(84532);
    });
  });

  describe('CHAIN_ID_TO_NETWORK', () => {
    it('should map chain IDs to network types', () => {
      expect(CHAIN_ID_TO_NETWORK[1]).toBe(NetworkType.Mainnet);
      expect(CHAIN_ID_TO_NETWORK[11155111]).toBe(NetworkType.Sepolia);
      expect(CHAIN_ID_TO_NETWORK[8453]).toBe(NetworkType.BaseMainnet);
      expect(CHAIN_ID_TO_NETWORK[84532]).toBe(NetworkType.BaseSepolia);
    });

    it('should be inverse of NETWORK_CHAIN_IDS', () => {
      Object.entries(NETWORK_CHAIN_IDS).forEach(([network, chainId]) => {
        expect(CHAIN_ID_TO_NETWORK[chainId]).toBe(network);
      });
    });
  });

  describe('DEFAULT_RPC_URLS', () => {
    it('should have RPC URLs for all networks', () => {
      availableNetworks.forEach((network) => {
        expect(DEFAULT_RPC_URLS[network]).toBeDefined();
        expect(DEFAULT_RPC_URLS[network]).toMatch(/^https:\/\//);
      });
    });
  });

  describe('BLOCK_EXPLORER_URLS', () => {
    it('should have explorer URLs for all networks', () => {
      availableNetworks.forEach((network) => {
        expect(BLOCK_EXPLORER_URLS[network]).toBeDefined();
        expect(BLOCK_EXPLORER_URLS[network]).toMatch(/^https:\/\//);
      });
    });
  });

  describe('getNetworkDisplayName', () => {
    it('should return human-readable names', () => {
      expect(getNetworkDisplayName(NetworkType.Mainnet)).toBe('Ethereum Mainnet');
      expect(getNetworkDisplayName(NetworkType.Sepolia)).toBe('Ethereum Sepolia');
      expect(getNetworkDisplayName(NetworkType.BaseMainnet)).toBe('Base Mainnet');
      expect(getNetworkDisplayName(NetworkType.BaseSepolia)).toBe('Base Sepolia');
    });
  });

  describe('isTestnet', () => {
    it('should identify testnets correctly', () => {
      expect(isTestnet(NetworkType.Sepolia)).toBe(true);
      expect(isTestnet(NetworkType.BaseSepolia)).toBe(true);
    });

    it('should identify mainnets correctly', () => {
      expect(isTestnet(NetworkType.Mainnet)).toBe(false);
      expect(isTestnet(NetworkType.BaseMainnet)).toBe(false);
    });
  });

  describe('getTransactionExplorerUrl', () => {
    const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    it('should generate correct Etherscan URL for mainnet', () => {
      const url = getTransactionExplorerUrl(NetworkType.Mainnet, txHash);
      expect(url).toBe(`https://etherscan.io/tx/${txHash}`);
    });

    it('should generate correct Basescan URL for Base mainnet', () => {
      const url = getTransactionExplorerUrl(NetworkType.BaseMainnet, txHash);
      expect(url).toBe(`https://basescan.org/tx/${txHash}`);
    });

    it('should generate correct URL for Base Sepolia', () => {
      const url = getTransactionExplorerUrl(NetworkType.BaseSepolia, txHash);
      expect(url).toBe(`https://sepolia.basescan.org/tx/${txHash}`);
    });
  });

  describe('getAddressExplorerUrl', () => {
    const address = '0x9855054731540A48b28990B63DcF4f33d8AE46A1';

    it('should generate correct address URL for mainnet', () => {
      const url = getAddressExplorerUrl(NetworkType.Mainnet, address);
      expect(url).toBe(`https://etherscan.io/address/${address}`);
    });

    it('should generate correct address URL for Base Sepolia', () => {
      const url = getAddressExplorerUrl(NetworkType.BaseSepolia, address);
      expect(url).toBe(`https://sepolia.basescan.org/address/${address}`);
    });
  });
});
