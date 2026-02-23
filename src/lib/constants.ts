import { NetworkType, TaskOriginRole } from './types';

export const availableNetworks: NetworkType[] = [
  NetworkType.Mainnet,
  NetworkType.Sepolia,
  NetworkType.SepoliaAlpha,
];

// Task origin signature file names (hardcoded per role)
export const TASK_ORIGIN_SIGNATURE_FILE_NAMES: Record<TaskOriginRole, string> = {
  taskCreator: 'creator-signature.json',
  baseFacilitator: 'base-facilitator-signature.json',
  securityCouncilFacilitator: 'base-sc-facilitator-signature.json',
};

// Task origin common names (hardcoded for facilitators, taskCreator comes from config)
export const TASK_ORIGIN_COMMON_NAMES = {
  baseFacilitator: 'base-facilitators',
  securityCouncilFacilitator: 'base-sc-facilitators',
} as const;
