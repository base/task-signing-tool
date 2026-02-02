import { createPublicClient, http, decodeFunctionData, Hex, Address } from 'viem';

const DEPOSIT_TRANSACTION_ABI = [
  {
    name: 'depositTransaction',
    type: 'function',
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
      { name: '_gasLimit', type: 'uint64' },
      { name: '_isCreation', type: 'bool' },
      { name: '_data', type: 'bytes' },
    ],
  },
] as const;

type DepositTransaction = {
  to: Address;
  value: bigint;
  gasLimit: bigint;
  isCreation: boolean;
  data: Hex;
};

export class L2GasEstimator {
  /**
   * Decodes depositTransaction calldata to extract L2 transaction details
   */
  decodeDepositTransaction(data: Hex): DepositTransaction {
    const decoded = decodeFunctionData({
      abi: DEPOSIT_TRANSACTION_ABI,
      data,
    });

    const [to, value, gasLimit, isCreation, l2Data] = decoded.args;

    return {
      to,
      value,
      gasLimit,
      isCreation,
      data: l2Data as Hex,
    };
  }

  /**
   * Estimates L2 gas using viem's estimateGas
   */
  async estimateL2Gas(l2RpcUrl: string, deposit: DepositTransaction): Promise<bigint> {
    console.log('🔧 Estimating L2 gas with viem...');
    console.log(`   L2 RPC: ${l2RpcUrl}`);
    console.log(`   Target: ${deposit.to}`);
    console.log(`   Value: ${deposit.value}`);
    console.log(`   Calldata length: ${deposit.data.length} chars`);

    const l2Client = createPublicClient({
      transport: http(l2RpcUrl),
    });

    try {
      const gasEstimate = await l2Client.estimateGas({
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
