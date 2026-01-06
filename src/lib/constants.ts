import { NetworkType } from './types';

/**
 * Available networks for task signing operations.
 * Includes both L1 networks (Ethereum Mainnet, Sepolia) and
 * L2 networks (Base Mainnet, Base Sepolia) for comprehensive coverage.
 */
export const availableNetworks: NetworkType[] = [
  NetworkType.Mainnet,
  NetworkType.Sepolia,
  NetworkType.BaseMainnet,
  NetworkType.BaseSepolia,
];

/**
 * Default RPC URLs for each network (can be overridden in task configs)
 */
export const DEFAULT_RPC_URLS: Record<NetworkType, string> = {
  [NetworkType.Mainnet]: 'https://eth.llamarpc.com',
  [NetworkType.Sepolia]: 'https://sepolia.drpc.org',
  [NetworkType.BaseMainnet]: 'https://mainnet.base.org',
  [NetworkType.BaseSepolia]: 'https://sepolia.base.org',
};

/**
 * Block explorer URLs for each network
 */
export const BLOCK_EXPLORER_URLS: Record<NetworkType, string> = {
  [NetworkType.Mainnet]: 'https://etherscan.io',
  [NetworkType.Sepolia]: 'https://sepolia.etherscan.io',
  [NetworkType.BaseMainnet]: 'https://basescan.org',
  [NetworkType.BaseSepolia]: 'https://sepolia.basescan.org',
};

/**
 * Get block explorer URL for a transaction
 */
export function getTransactionExplorerUrl(network: NetworkType, txHash: string): string {
  return `${BLOCK_EXPLORER_URLS[network]}/tx/${txHash}`;
}

/**
 * Get block explorer URL for an address
 */
export function getAddressExplorerUrl(network: NetworkType, address: string): string {
  return `${BLOCK_EXPLORER_URLS[network]}/address/${address}`;
}
