package template

import (
	_ "embed"
	"fmt"
	"sort"
	"strings"

	"github.com/base/task-signing-tool/state-diff/config"
	"github.com/base/task-signing-tool/state-diff/internal/processor"
	"github.com/ethereum/go-ethereum/common"
	"github.com/holiman/uint256"
	"gopkg.in/yaml.v2"
)

type StorageDiff struct {
	Key         common.Hash
	ValueBefore common.Hash
	ValueAfter  common.Hash
	Preimage    string
}

type StateDiff struct {
	Address       common.Address
	BalanceBefore *uint256.Int
	BalanceAfter  *uint256.Int
	NonceSeen     bool
	NonceBefore   uint64
	NonceAfter    uint64
	StorageDiffs  map[common.Hash]StorageDiff
}

type Slot struct {
	Type            string `yaml:"type"`
	Summary         string `yaml:"summary"`
	OverrideMeaning string `yaml:"override-meaning"`
}

type Contract struct {
	Name  string          `yaml:"name"`
	Slots map[string]Slot `yaml:"slots"`
}

type Config struct {
	Contracts      map[string]map[string]Contract `yaml:"contracts"`
	StorageLayouts map[string]map[string]Slot     `yaml:"storage-layouts"`
}

var DEFAULT_CONTRACT = Contract{Name: "<<ContractName>>", Slots: map[string]Slot{}}
var DEFAULT_SLOT = Slot{Type: "<<DecodedKind>>", Summary: "<<Summary>>", OverrideMeaning: "<<OverrideMeaning>>"}

type FileGenerator struct {
	chainId string
	cfg     *Config
}

func NewFileGenerator(chainId string) (*FileGenerator, error) {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Printf("Error loading config: %v\n", err)
		return nil, err
	}
	return &FileGenerator{chainId, cfg}, nil
}

func loadConfig() (*Config, error) {
	// Use the embedded config file content
	var cfg Config
	// err := yaml.Unmarshal(config.EmbeddedConfigFile, &cfg)
	err := cfg.UnmarshalYAML()
	if err != nil {
		// If unmarshalling fails, return an error
		return nil, fmt.Errorf("error parsing embedded config file: %w", err)
	}

	return &cfg, nil
}

// UnmarshalYAML implements the yaml.Unmarshaler interface for Config.
// This custom unmarshaler handles the case where a contract's slots can be
// defined directly or as a reference to a pre-defined storage layout
// (e.g., "${{storage-layouts.gnosis-safe}}").
func (c *Config) UnmarshalYAML() error {
	// Define auxiliary types to handle the flexible 'slots' field during initial parsing.
	type auxContractDefinition struct {
		Name  string `yaml:"name"`
		Slots any    `yaml:"slots"` // Slots can be a map or a string reference
	}
	type auxConfigStructure struct {
		Contracts      map[string]map[string]auxContractDefinition `yaml:"contracts"`
		StorageLayouts map[string]map[string]Slot                  `yaml:"storage-layouts"`
	}

	var rawAuxData auxConfigStructure
	if err := yaml.Unmarshal(config.EmbeddedConfigFile, &rawAuxData); err != nil {
		return fmt.Errorf("error unmarshaling raw config structure: %w", err)
	}

	c.StorageLayouts = rawAuxData.StorageLayouts
	c.Contracts = make(map[string]map[string]Contract)

	for chainID, contractAddressesMap := range rawAuxData.Contracts {
		c.Contracts[chainID] = make(map[string]Contract)
		for contractAddr, rawContract := range contractAddressesMap {
			finalizedContract := Contract{
				Name: rawContract.Name,
			}

			switch slotsValue := rawContract.Slots.(type) {
			case string:
				// Handle string references like "${{storage-layouts.LAYOUT_NAME}}"
				if strings.HasPrefix(slotsValue, "${{storage-layouts.") && strings.HasSuffix(slotsValue, "}}") {
					layoutName := strings.TrimSuffix(strings.TrimPrefix(slotsValue, "${{storage-layouts."), "}}")
					if layout, ok := rawAuxData.StorageLayouts[layoutName]; ok {
						finalizedContract.Slots = layout
					} else {
						return fmt.Errorf("storage layout '%s' referenced by contract '%s' (address: %s, chain: %s) not found in storage-layouts section", layoutName, rawContract.Name, contractAddr, chainID)
					}
				} else {
					return fmt.Errorf("invalid string format for slots on contract '%s' (address: %s, chain: %s): expected '${{storage-layouts.LAYOUT_NAME}}', got '%s'", rawContract.Name, contractAddr, chainID, slotsValue)
				}
			case nil:
				// If 'slots' is null or not provided in YAML, initialize with an empty map.
				// This case might be removed if it's guaranteed 'slots' will always be a string reference.
				finalizedContract.Slots = make(map[string]Slot)
			default:
				return fmt.Errorf("unexpected type for 'slots' field in contract '%s' (address: %s, chain: %s): expected a string reference like '${{storage-layouts.LAYOUT_NAME}}', got type %T", rawContract.Name, contractAddr, chainID, rawContract.Slots)
			}
			c.Contracts[chainID][contractAddr] = finalizedContract
		}
	}
	return nil
}

// BuildValidationJSON creates a JSON representation of the validation data in the new format
func (g *FileGenerator) BuildValidationJSON(taskName, scriptName, signature, args, safe string, overrides []processor.Override, diffs []StateDiff, domainHash, messageHash []byte, parentMap map[common.Hash]common.Hash) (*ValidationResultFormatted, error) {
	result := &ValidationResultFormatted{
		TaskName:   taskName,
		ScriptName: scriptName,
		Signature:  signature,
		Args:       args,
		ExpectedDomainAndMessageHashes: DomainAndMessageHashes{
			Address:     safe,
			DomainHash:  fmt.Sprintf("0x%x", domainHash),
			MessageHash: fmt.Sprintf("0x%x", messageHash),
		},
		ExpectedNestedHash: "", // This can be set later if needed
		StateOverrides:     g.convertOverridesToJSON(overrides, parentMap),
		StateChanges:       g.convertDiffsToJSON(diffs, parentMap),
	}
	return result, nil
}

// convertOverridesToJSON converts state overrides to JSON format
func (g *FileGenerator) convertOverridesToJSON(overrides []processor.Override, parentMap map[common.Hash]common.Hash) []StateOverride {
	result := make([]StateOverride, 0, len(overrides))

	// Sort overrides by address
	sort.Slice(overrides, func(i, j int) bool {
		return overrides[i].ContractAddress.String() < overrides[j].ContractAddress.String()
	})

	for _, override := range overrides {
		contract := g.getContractCfg(override.ContractAddress.Hex())
		jsonOverrides := make([]Override, 0, len(override.Storage))

		// Sort storage overrides by key
		sort.Slice(override.Storage, func(i, j int) bool {
			return override.Storage[i].Key.String() < override.Storage[j].Key.String()
		})

		for _, storageOverride := range override.Storage {
			slot := g.getSlot(&contract, storageOverride.Key, parentMap)
			jsonOverrides = append(jsonOverrides, Override{
				Key:         storageOverride.Key.Hex(),
				Value:       storageOverride.Value.Hex(),
				Description: slot.OverrideMeaning,
			})
		}

		result = append(result, StateOverride{
			Name:      contract.Name,
			Address:   override.ContractAddress.Hex(),
			Overrides: jsonOverrides,
		})
	}

	return result
}

// convertDiffsToJSON converts state diffs to JSON format
func (g *FileGenerator) convertDiffsToJSON(diffs []StateDiff, parentMap map[common.Hash]common.Hash) []StateChange {
	result := make([]StateChange, 0, len(diffs))

	// Sort diffs by address
	sort.Slice(diffs, func(i, j int) bool {
		return diffs[i].Address.String() < diffs[j].Address.String()
	})

	for _, diff := range diffs {
		contract := g.getContractCfg(diff.Address.String())
		jsonChanges := make([]Change, 0)

		// Convert storage diffs to slice for sorting
		storageDiffs := make([]StorageDiff, 0, len(diff.StorageDiffs))
		for _, storageDiff := range diff.StorageDiffs {
			storageDiffs = append(storageDiffs, storageDiff)
		}

		// Sort storage diffs by key
		sort.Slice(storageDiffs, func(i, j int) bool {
			return storageDiffs[i].Key.String() < storageDiffs[j].Key.String()
		})

		for _, storageDiff := range storageDiffs {
			// Skip if no actual change
			if storageDiff.ValueBefore == storageDiff.ValueAfter {
				continue
			}

			slot := g.getSlot(&contract, storageDiff.Key, parentMap)
			jsonChanges = append(jsonChanges, Change{
				Key:         storageDiff.Key.Hex(),
				Before:      storageDiff.ValueBefore.Hex(),
				After:       storageDiff.ValueAfter.Hex(),
				Description: slot.Summary,
			})
		}

		// Only add if there are actual changes
		if len(jsonChanges) > 0 {
			result = append(result, StateChange{
				Name:    contract.Name,
				Address: diff.Address.Hex(),
				Changes: jsonChanges,
			})
		}
	}

	return result
}

func (g *FileGenerator) getContractCfg(address string) Contract {
	contract, ok := g.cfg.Contracts[g.chainId][strings.ToLower(address)]
	if !ok {
		return DEFAULT_CONTRACT
	}

	return contract
}

func (g *FileGenerator) getSlot(cfg *Contract, slot common.Hash, parentMap map[common.Hash]common.Hash) Slot {
	slotType, ok := cfg.Slots[strings.ToLower(slot.String())]

	if ok {
		return slotType
	}

	// If key not recognized as slot, look for preimage
	for {
		slot, ok = parentMap[slot]

		if !ok {
			return DEFAULT_SLOT
		}

		slotType, ok = cfg.Slots[strings.ToLower(slot.String())]
		if ok {
			return slotType
		}
	}
}
