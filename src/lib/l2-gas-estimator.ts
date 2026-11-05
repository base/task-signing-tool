import { createPublicClient, http, Hex, Address, slice, hexToBigInt, hexToBool } from 'viem';

type DepositTransaction = {
  from: Address;
  to: Address;
  value: bigint;
  gasLimit: bigint;
  isCreation: boolean;
  data: Hex;
};

export class L2GasEstimator {
  /**
   * Extracts L2 transaction details from TransactionDeposited event in forge output
   * The -vvvv flag is automatically added by genValidationFile when --estimate-l2-gas is enabled
   */
  extractDepositFromForgeOutput(forgeOutput: string): DepositTransaction | null {
    try {
      const eventMatch = forgeOutput.match(/emit TransactionDeposited\([^)]+\)/);
      if (!eventMatch) {
        console.warn('Could not find TransactionDeposited event in forge output');
        console.warn('This may indicate the transaction does not emit TransactionDeposited');
        return null;
      }

      const eventLine = eventMatch[0];

      // L2 sender, already aliased if needed
      const fromMatch = eventLine.match(/from:\s*(0x[0-9a-fA-F]{40})/);
      if (!fromMatch) {
        console.warn('Could not extract "from" address from TransactionDeposited event');
        return null;
      }
      const from = fromMatch[1] as Address;

      const toMatch = eventLine.match(/to:\s*(0x[0-9a-fA-F]{40})/);
      if (!toMatch) {
        console.warn('Could not extract "to" address from TransactionDeposited event');
        return null;
      }
      const to = toMatch[1] as Address;

      const opaqueDataMatch = eventLine.match(/opaqueData:\s*(0x[0-9a-fA-F]+)/);
      if (!opaqueDataMatch) {
        console.warn('Could not extract opaqueData from TransactionDeposited event');
        return null;
      }

      const opaqueData = opaqueDataMatch[1] as Hex;

      // Decode opaqueData: abi.encodePacked(msg.value, _value, _gasLimit, _isCreation, _data)
      // Note: We cannot use viem's decodeAbiParameters here because encodePacked removes padding
      // and type information, so we must manually decode by byte offsets:
      // msg.value: uint256 (32 bytes)
      // _value: uint256 (32 bytes)
      // _gasLimit: uint64 (8 bytes)
      // _isCreation: bool (1 byte)
      // _data: bytes (remaining)

      const value = hexToBigInt(slice(opaqueData, 32, 64));

      const gasLimit = hexToBigInt(slice(opaqueData, 64, 72));

      const isCreation = hexToBool(slice(opaqueData, 72, 73));

      const data = slice(opaqueData, 73) as Hex;

      return {
        from,
        to,
        value,
        gasLimit,
        isCreation,
        data,
      };
    } catch (error) {
      console.error('Failed to extract deposit from forge output:', error);
      return null;
    }
  }

  async estimateL2Gas(l2RpcUrl: string, deposit: DepositTransaction): Promise<bigint> {
    console.log('🔧 Estimating L2 gas with viem...');
    console.log(`   L2 RPC: ${l2RpcUrl}`);
    console.log(`   From: ${deposit.from}`);
    console.log(`   Target: ${deposit.to}`);
    console.log(`   Value: ${deposit.value}`);
    console.log(`   Calldata length: ${deposit.data.length} chars`);

    const l2Client = createPublicClient({
      transport: http(l2RpcUrl),
    });

    try {
      const gasEstimate = await l2Client.estimateGas({
        account: deposit.from,
        to: deposit.to,
        value: deposit.value,
        data: deposit.data,
      });

      console.log('✅ L2 gas estimation completed');
      console.log(`   Estimated gas: ${gasEstimate}`);

      return gasEstimate;
    } catch (error) {
      console.error('❌ L2 gas estimation failed:', error);
      throw new Error(`Failed to estimate L2 gas: ${error}`);
    }
  }
}
