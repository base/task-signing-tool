package transaction

import (
	"fmt"
	"math/big"
	"net/url"
	"reflect"
	"strings"

	"github.com/base/task-signing-tool/state-diff/bindings"
	"github.com/base/task-signing-tool/state-diff/internal/state"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/core/vm"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/holiman/uint256"
)

var VALUE = big.NewInt(0)
var GAS = uint64(8000000)

func CreateTransaction(client *ethclient.Client, chainID *big.Int, m url.Values) (*types.Transaction, error) {
	recipient := common.HexToAddress(m["contractAddress"][0])
	value := VALUE
	data := common.FromHex(m["rawFunctionInput"][0])

	txData := types.DynamicFeeTx{
		ChainID:   chainID,
		Nonce:     0,
		GasTipCap: big.NewInt(0),
		GasFeeCap: big.NewInt(0),
		Gas:       GAS,
		To:        &recipient,
		Value:     value,
		Data:      data,
	}

	return types.NewTx(&txData), nil
}

// SimulateTransaction simulates a transaction and returns the state diff
func SimulateTransaction(evm *vm.EVM, tx *types.Transaction, from common.Address) ([]state.StateDiff, error) {
	statedb := evm.StateDB
	to := *tx.To()

	value := new(uint256.Int)
	value.SetFromBig(tx.Value())

	ret, gasUsed, err := evm.Call(from, to, tx.Data(), tx.Gas(), value)
	if err != nil {
		if err == vm.ErrExecutionReverted {
			reason := string(ret)
			fmt.Printf("EVM Call reverted. Gas used: %d\n", gasUsed)
			fmt.Printf("Revert reason bytes: %x\n", ret)
			fmt.Printf("Revert reason: %s\n", reason)
			return nil, fmt.Errorf("transaction reverted during simulation: %w", err)
		} else {
			return nil, fmt.Errorf("failed to execute transaction simulation: %w", err)
		}
	}

	cachingDB := statedb.(*state.CachingStateDB)
	return cachingDB.GetStateDiffs(), nil
}

func GetTargetedSafe(tx *types.Transaction) (string, error) {
	multicallAddress := common.HexToAddress("0xcA11bde05977b3631167028862bE2a173976CA11")

	if *tx.To() == multicallAddress {
		parsedABI, err := abi.JSON(strings.NewReader(bindings.Multicall3ABI))
		if err != nil {
			return "", fmt.Errorf("failed to parse Multicall3 ABI: %w", err)
		}

		// Check if the data corresponds to the 'aggregate' function (first 4 bytes)
		methodID := tx.Data()[:4]
		method, err := parsedABI.MethodById(methodID)
		if err != nil {
			return "", fmt.Errorf("failed to identify method: %w", err)
		}

		// Unpack the arguments
		// We expect the input data for aggregate to be: methodID (4 bytes) + encoded arguments
		argsData := tx.Data()[4:]

		// Unpack using the signature revealed by the linter: returns ([]any, error)
		unpackedSlice, err := method.Inputs.Unpack(argsData)
		if err != nil {
			return "", fmt.Errorf("failed to unpack aggregate arguments using aggregateMethod.Inputs.Unpack: %w", err)
		}

		// The aggregate function has one input: calls []Multicall3Call
		// So, unpackedSlice should contain one element: the calls array itself.
		if len(unpackedSlice) != 1 {
			return "", fmt.Errorf("unexpected number of arguments unpacked: expected 1, got %d", len(unpackedSlice))
		}

		// The first element should be the []Multicall3Call.
		// Try asserting directly to the slice of the defined struct type.
		calls, ok := unpackedSlice[0].([]struct {
			Target       common.Address "json:\"target\""
			AllowFailure bool           "json:\"allowFailure\""
			CallData     []uint8        "json:\"callData\""
		})
		if !ok {
			// If this fails, use reflection to inspect the actual type
			actualType := reflect.TypeOf(unpackedSlice[0])
			return "", fmt.Errorf("failed to assert unpacked argument to []Multicall3Call. Actual type: %s", actualType.String())
		}

		if len(calls) == 0 {
			return "", fmt.Errorf("decoded 'calls' array is empty")
		}

		// Extract the target address from the first call
		targetAddress := calls[0].Target
		return targetAddress.String(), nil
	}

	return tx.To().String(), nil
}
