export enum NetworkType {
  Sepolia = 'sepolia',
  Mainnet = 'mainnet',
  BaseSepolia = 'base-sepolia',
  BaseMainnet = 'base-mainnet',
}

export enum TaskStatus {
  Executed = 'EXECUTED',
  ReadyToSign = 'READY TO SIGN',
  Pending = 'PENDING',
}

export interface ExecutionLink {
  url: string;
  label: string;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  date: string;
  network: string;
  status?: TaskStatus;
  executionLinks?: ExecutionLink[];
}

/**
 * Maps NetworkType to chain ID for use with RPC providers
 */
export const NETWORK_CHAIN_IDS: Record<NetworkType, number> = {
  [NetworkType.Mainnet]: 1,
  [NetworkType.Sepolia]: 11155111,
  [NetworkType.BaseMainnet]: 8453,
  [NetworkType.BaseSepolia]: 84532,
};

/**
 * Maps chain ID to NetworkType for reverse lookup
 */
export const CHAIN_ID_TO_NETWORK: Record<number, NetworkType> = {
  1: NetworkType.Mainnet,
  11155111: NetworkType.Sepolia,
  8453: NetworkType.BaseMainnet,
  84532: NetworkType.BaseSepolia,
};

/**
 * Get display name for a network
 */
export function getNetworkDisplayName(network: NetworkType): string {
  const displayNames: Record<NetworkType, string> = {
    [NetworkType.Mainnet]: 'Ethereum Mainnet',
    [NetworkType.Sepolia]: 'Ethereum Sepolia',
    [NetworkType.BaseMainnet]: 'Base Mainnet',
    [NetworkType.BaseSepolia]: 'Base Sepolia',
  };
  return displayNames[network] || network;
}

/**
 * Check if a network is a testnet
 */
export function isTestnet(network: NetworkType): boolean {
  return network === NetworkType.Sepolia || network === NetworkType.BaseSepolia;
}
