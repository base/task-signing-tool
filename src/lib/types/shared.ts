export enum NetworkType {
  Sepolia = 'sepolia',
  Mainnet = 'mainnet',
  SepoliaAlpha = 'sepolia-alpha',
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
