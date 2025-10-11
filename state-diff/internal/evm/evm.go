package evm

import (
	"context"
	"fmt"
	"math/big"

	"github.com/base/task-signing-tool/state-diff/internal/chain"
	"github.com/base/task-signing-tool/state-diff/internal/state"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core"
	"github.com/ethereum/go-ethereum/core/rawdb"
	"github.com/ethereum/go-ethereum/core/vm"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/params"
)

func NewEVM(client *ethclient.Client, chainID *big.Int, overrides string) (*vm.EVM, error) {
	// Get the latest block headers
	blockHeader, err := client.HeaderByNumber(context.Background(), nil)
	if err != nil {
		return nil, fmt.Errorf("error getting block: %w", err)
	}

	// Get the chain configuration based on chain ID
	var chainConfig *params.ChainConfig
	switch chainID.Int64() {
	case 1: // Ethereum
		chainConfig = params.MainnetChainConfig
	case 11155111: // Sepolia
		chainConfig = params.SepoliaChainConfig
	case 8453: // Base Mainnet
		// TODO: Ideally, use Base-specific chain config if available.
		// For now, Sepolia config might be a closer starting point
		// than Mainnet, but this needs verification.
		// The primary issue is likely transaction type support, not just config params.
		chainConfig = params.SepoliaChainConfig // Placeholder
	default:
		fmt.Printf("Unsupported chain ID: %d\n", chainID.Int64())
		return nil, fmt.Errorf("unsupported chain ID: %d", chainID.Int64())
	}

	// Create a memory database for local storage
	memDB := rawdb.NewMemoryDatabase()

	// Create a caching state database
	cachingDB := state.NewCachingStateDB(client, blockHeader.Number, memDB)

	cachingDB.(*state.CachingStateDB).SetOverrides(overrides)

	blockContext := core.NewEVMBlockContext(
		blockHeader,
		chain.NewChainContext(chainConfig, client),
		&common.Address{},
	)

	// Create a new EVM instance with the state database
	var evmConfig vm.Config
	evmConfig.EnablePreimageRecording = true
	return vm.NewEVM(blockContext, cachingDB, chainConfig, evmConfig), nil
}
