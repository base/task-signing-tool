package processor

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
)

type VmSafeChainInfo struct {
	ForkId  *big.Int
	ChainId *big.Int
}

type VmSafeStorageAccess struct {
	Account       common.Address
	Slot          [32]byte
	IsWrite       bool
	PreviousValue [32]byte
	NewValue      [32]byte
	Reverted      bool
}

type VmSafeAccountAccess struct {
	ChainInfo       VmSafeChainInfo
	Kind            uint8
	Account         common.Address
	Accessor        common.Address
	Initialized     bool
	OldBalance      *big.Int
	NewBalance      *big.Int
	DeployedCode    []byte
	Value           *big.Int
	Data            []byte
	Reverted        bool
	StorageAccesses []VmSafeStorageAccess
	Depth           uint64
	OldNonce        uint64
	NewNonce        uint64
}

type Parsed struct {
	TargetSafe string `json:"targetSafe"`
	DataToSign string `json:"dataToSign"`
	StateDiff  string `json:"stateDiff"`
	Preimages  string `json:"preimages"`
	Overrides  string `json:"overrides"`
}

type Payload struct {
	From           common.Address
	To             common.Address
	Data           []byte
	StateOverrides []Override
}

type StorageOverride struct {
	Key   common.Hash `json:"key"`
	Value common.Hash `json:"value"`
}

type Override struct {
	ContractAddress common.Address    `json:"contractAddress"`
	Storage         []StorageOverride `json:"storage"`
}

func ReadEncodedStateDiff(workdir string) (*Parsed, error) {
	p := workdir + "/diff.json"
	data, err := os.ReadFile(p)
	if err != nil {
		return &Parsed{}, fmt.Errorf("failed to read diff.json: %w", err)
	}

	var parsed Parsed
	if err := json.Unmarshal(data, &parsed); err != nil {
		return &Parsed{}, fmt.Errorf("failed to parse %s: %w", p, err)
	}
	if parsed.StateDiff == "" {
		return &Parsed{}, fmt.Errorf("stateDiff missing in %s", p)
	}
	return &parsed, nil
}

func DecodeOverrides(encodedOverrides string) (*Payload, error) {
	data := common.FromHex(strings.TrimSpace(encodedOverrides))
	if len(data) == 0 {
		return &Payload{}, fmt.Errorf("empty or invalid hex string for simulation payload")
	}

	storageOverrideComponents := []abi.ArgumentMarshaling{
		{Name: "key", Type: "bytes32"},
		{Name: "value", Type: "bytes32"},
	}

	stateOverrideComponents := []abi.ArgumentMarshaling{
		{Name: "contractAddress", Type: "address"},
		{Name: "overrides", Type: "tuple[]", Components: storageOverrideComponents},
	}

	payloadComponents := []abi.ArgumentMarshaling{
		{Name: "from", Type: "address"},
		{Name: "to", Type: "address"},
		{Name: "data", Type: "bytes"},
		{Name: "stateOverrides", Type: "tuple[]", Components: stateOverrideComponents},
	}

	payload, err := abi.NewType("tuple", "Payload", payloadComponents)
	if err != nil {
		return nil, fmt.Errorf("failed creating ABI type: %w", err)
	}

	args := abi.Arguments{{Type: payload}}
	unpacked, err := args.Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode payload: %w", err)
	}
	if len(unpacked) == 0 {
		return &Payload{}, nil
	}
	decoded := abi.ConvertType(unpacked[0], new(Payload)).(*Payload)
	return decoded, nil
}

func DecodeStateDiff(encodedDiff string) ([]VmSafeAccountAccess, error) {
	// Decode hex string into bytes
	data := common.FromHex(strings.TrimSpace(encodedDiff))
	if len(data) == 0 {
		return nil, fmt.Errorf("empty or invalid hex string for state diff")
	}

	// Define ABI type for VmSafeAccountAccess[] as a tuple[]
	chainInfo := abi.ArgumentMarshaling{
		Name: "chainInfo",
		Type: "tuple",
		Components: []abi.ArgumentMarshaling{
			{Name: "forkId", Type: "uint256"},
			{Name: "chainId", Type: "uint256"},
		},
	}

	storageAccessItemComponents := []abi.ArgumentMarshaling{
		{Name: "account", Type: "address"},
		{Name: "slot", Type: "bytes32"},
		{Name: "isWrite", Type: "bool"},
		{Name: "previousValue", Type: "bytes32"},
		{Name: "newValue", Type: "bytes32"},
		{Name: "reverted", Type: "bool"},
	}

	rootComponents := []abi.ArgumentMarshaling{
		chainInfo,
		{Name: "kind", Type: "uint8"},
		{Name: "account", Type: "address"},
		{Name: "accessor", Type: "address"},
		{Name: "initialized", Type: "bool"},
		{Name: "oldBalance", Type: "uint256"},
		{Name: "newBalance", Type: "uint256"},
		{Name: "deployedCode", Type: "bytes"},
		{Name: "value", Type: "uint256"},
		{Name: "data", Type: "bytes"},
		{Name: "reverted", Type: "bool"},
		{Name: "storageAccesses", Type: "tuple[]", Components: storageAccessItemComponents},
		{Name: "depth", Type: "uint64"},
		{Name: "oldNonce", Type: "uint64"},
		{Name: "newNonce", Type: "uint64"},
	}

	vmSafeAccountAccessArray, err := abi.NewType("tuple[]", "VmSafeAccountAccess[]", rootComponents)
	if err != nil {
		return nil, fmt.Errorf("failed creating ABI type: %w", err)
	}

	args := abi.Arguments{{Type: vmSafeAccountAccessArray}}
	unpacked, err := args.Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode state diff: %w", err)
	}
	if len(unpacked) == 0 {
		return []VmSafeAccountAccess{}, nil
	}

	decoded := abi.ConvertType(unpacked[0], new([]VmSafeAccountAccess)).(*[]VmSafeAccountAccess)
	return *decoded, nil
}

type Parent struct {
	Slot   [32]byte
	Parent [32]byte
	Key    [32]byte
}

func DecodePreimages(preimages string) ([]Parent, error) {
	data := common.FromHex(strings.TrimSpace(preimages))
	if len(data) == 0 {
		return nil, fmt.Errorf("empty or invalid hex string for mapping preimages")
	}

	parentComponents := []abi.ArgumentMarshaling{
		{Name: "slot", Type: "bytes32"},
		{Name: "parent", Type: "bytes32"},
		{Name: "key", Type: "bytes32"},
	}

	parentAbiType, err := abi.NewType("tuple[]", "Parent", parentComponents)
	if err != nil {
		return nil, fmt.Errorf("failed creating ABI type: %w", err)
	}

	args := abi.Arguments{{Type: parentAbiType}}
	unpacked, err := args.Unpack(data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode mapping preimages: %w", err)
	}
	if len(unpacked) == 0 {
		return []Parent{}, nil
	}
	decoded := abi.ConvertType(unpacked[0], new([]Parent)).(*[]Parent)
	return *decoded, nil
}

func GetDomainAndMessageHash(input string) ([]byte, []byte, error) {
	fmt.Println()
	hash := common.FromHex(strings.TrimSpace(string(input)))
	if len(hash) != 66 {
		return nil, nil, fmt.Errorf("expected EIP-712 hex string with 66 bytes, got %d bytes, value: %s", len(input), string(input))
	}

	domainHash := hash[2:34]
	messageHash := hash[34:66]
	fmt.Printf("Domain hash: 0x%s\n", hex.EncodeToString(domainHash))
	fmt.Printf("Message hash: 0x%s\n", hex.EncodeToString(messageHash))

	return domainHash, messageHash, nil
}
