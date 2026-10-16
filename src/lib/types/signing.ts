export type HardwareWallet = 'ledger' | 'trezor';

export interface SigningResult {
  success: boolean;
  data?: string;
  signature?: string;
  signer?: string;
  error?: string;
}
