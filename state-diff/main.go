package main

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/jackchuma/state-diff/internal/command"
	"github.com/jackchuma/state-diff/internal/evm"
	"github.com/jackchuma/state-diff/internal/state"
	"github.com/jackchuma/state-diff/internal/template"
	"github.com/jackchuma/state-diff/internal/transaction"
)

func main() {
	var prefix string
	var suffix string
	var workdir string
	var rpcURL string
	var outputFile string
	var outputFormat string
	// New flags for pre-extracted data
	var useExtractedData bool
	var signingData string
	var tenderlyLink string
	var stateOverrides string
	var rawFunctionInput string
	var senderAddress string
		var networkID string
	var contractAddress string

	flag.StringVar(&prefix, "prefix", "vvvvvvvv", "String that prefixes the data to be signed")
	flag.StringVar(&suffix, "suffix", "^^^^^^^^", "String that suffixes the data to be signed")
	flag.StringVar(&workdir, "workdir", ".", "Directory in which to run the subprocess")
	flag.StringVar(&rpcURL, "rpc", "", "RPC URL to connect to")
	flag.StringVar(&outputFile, "o", "", "Output file path")
	flag.StringVar(&outputFormat, "format", "tool", "Output format: tool (for TypeScript compatibility) or json (base-nested.json format with empty metadata fields)")

	// New flags for extracted data
	flag.BoolVar(&useExtractedData, "use-extracted", false, "Use pre-extracted data instead of running script")
	flag.StringVar(&signingData, "signing-data", "", "EIP-712 signing data (hex string, 66 bytes)")
	flag.StringVar(&tenderlyLink, "tenderly-link", "", "Tenderly simulation URL (optional, for reference/logging)")
	flag.StringVar(&stateOverrides, "state-overrides", "", "State overrides JSON (optional)")
	flag.StringVar(&rawFunctionInput, "raw-input", "", "Raw function input (optional)")
	flag.StringVar(&senderAddress, "sender", "", "Sender address for simulation")
		flag.StringVar(&networkID, "network", "", "Network ID (optional)")
	flag.StringVar(&contractAddress, "contract", "", "Contract address (optional)")

	flag.Parse()

	if rpcURL == "" {
		fmt.Println("Error: RPC URL is required")
		os.Exit(1)
	}

	// Connect to the Ethereum node
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		fmt.Printf("Failed to connect to the Ethereum client: %v\n", err)
		os.Exit(1)
	}

	// Get chain ID
	chainID, err := client.ChainID(context.Background())
	if err != nil {
		fmt.Printf("Failed to get chain ID: %v\n", err)
		os.Exit(1)
	}

	var domainHash []byte
	var messageHash []byte
	var finalTenderlyLink string
	var m url.Values

	if useExtractedData {
		// Use pre-extracted data instead of running script
		if signingData == "" || senderAddress == "" {
			fmt.Println("Error: When using extracted data, signing-data and sender are required")
			os.Exit(1)
		}

		// Parse signing data to extract domain and message hashes
		domainHash, messageHash, err = parseSigningData(signingData)
		if err != nil {
			fmt.Printf("Error parsing signing data: %v\n", err)
			os.Exit(1)
		}

		// Build URL query values from extracted data
		finalTenderlyLink = tenderlyLink // Keep for display purposes if provided
		m = url.Values{}
		m.Set("from", senderAddress)
		if networkID != "" {
			m.Set("network", networkID)
		}
		if contractAddress != "" {
			m.Set("contractAddress", contractAddress)
		}
		if stateOverrides != "" {
			m.Set("stateOverrides", stateOverrides)
		}
		if rawFunctionInput != "" {
			m.Set("rawFunctionInput", rawFunctionInput)
		}

		// Print debug info to stderr to keep stdout clean for JSON
		fmt.Fprintf(os.Stderr, "Using pre-extracted data:\n")
		fmt.Fprintf(os.Stderr, "Domain hash: 0x%s\n", hex.EncodeToString(domainHash))
		fmt.Fprintf(os.Stderr, "Message hash: 0x%s\n", hex.EncodeToString(messageHash))
		if finalTenderlyLink != "" {
			fmt.Fprintf(os.Stderr, "Tenderly link: %s\n", finalTenderlyLink)
		}
	} else {
		// Original behavior: run script to extract data
		domainHash, messageHash, finalTenderlyLink, err = command.GetDomainAndMessageHash("", prefix, suffix, workdir)
		if err != nil {
			log.Fatalf("Error getting domain and message hashes: %v", err)
		}

		u, err := url.Parse(finalTenderlyLink)
		if err != nil {
			log.Fatalf("Failed to parse link: %v", err)
		}

		m, err = url.ParseQuery(u.RawQuery)
		if err != nil {
			log.Fatal("Failed to parse link query params", err)
		}
	}

	tx, err := transaction.CreateTransaction(client, chainID, m)
	if err != nil {
		log.Fatal("Failed to create transaction", err)
	}

	overrides := ""
	if len(m["stateOverrides"]) > 0 {
		overrides = m["stateOverrides"][0]
	} else if stateOverrides != "" {
		overrides = stateOverrides
	}

	evm, err := evm.NewEVM(client, chainID, overrides)
	if err != nil {
		log.Fatal("Failed to create evm: ", err)
	}

	sender := common.HexToAddress(senderAddress)
	if !useExtractedData && len(m["from"]) > 0 {
		sender = common.HexToAddress(m["from"][0])
	}

	// Simulate the transaction
	diffs, err := transaction.SimulateTransaction(evm, tx, sender)
	if err != nil {
		fmt.Printf("Error simulating transaction: %v\n", err)
		os.Exit(1)
	}

	// Print success message to stderr to keep stdout clean for JSON
	fmt.Fprintf(os.Stderr, "Transaction simulated successfully on chain %d at block %d\n", chainID.Int64(), evm.Context.BlockNumber.Int64())

	targetSafe, err := transaction.GetTargetedSafe(tx)
	if err != nil {
		fmt.Printf("Error getting target safe: %v\n", err)
		os.Exit(1)
	}

	fileGenerator, err := template.NewFileGenerator(evm.StateDB.(*state.CachingStateDB), chainID.String())
	if err != nil {
		fmt.Printf("Error creating file generator: %v\n", err)
		os.Exit(1)
	}

	// Generate output based on format
	if outputFormat == "tool" {
		// Generate JSON output for TypeScript tool compatibility
		jsonResult, err := fileGenerator.BuildValidationJSONForTool(targetSafe, evm.StateDB.(*state.CachingStateDB).GetOverrides(), diffs, domainHash, messageHash)
		if err != nil {
			fmt.Printf("Error generating JSON: %v\n", err)
			os.Exit(1)
		}

		jsonBytes, err := json.MarshalIndent(jsonResult, "", "  ")
		if err != nil {
			fmt.Printf("Error marshaling JSON: %v\n", err)
			os.Exit(1)
		}

		if outputFile != "" {
			err = os.WriteFile(outputFile, jsonBytes, 0644)
			if err != nil {
				fmt.Println("Error writing JSON file:", err)
				return
			}
		} else {
			fmt.Println(string(jsonBytes))
		}
	} else if outputFormat == "json" {
		// Generate JSON output in base-nested.json format
		jsonResult, err := fileGenerator.BuildValidationJSON("", "", "", "", targetSafe, evm.StateDB.(*state.CachingStateDB).GetOverrides(), diffs, domainHash, messageHash)
		if err != nil {
			fmt.Printf("Error generating formatted JSON: %v\n", err)
			os.Exit(1)
		}

		jsonBytes, err := json.MarshalIndent(jsonResult, "", "  ")
		if err != nil {
			fmt.Printf("Error marshaling formatted JSON: %v\n", err)
			os.Exit(1)
		}

		if outputFile != "" {
			err = os.WriteFile(outputFile, jsonBytes, 0644)
			if err != nil {
				fmt.Println("Error writing formatted JSON file:", err)
				return
			}
		} else {
			fmt.Println(string(jsonBytes))
		}
	} else {
		fmt.Printf("Error: Invalid output format '%s'. Use 'tool' or 'json'\n", outputFormat)
		os.Exit(1)
	}
}

// parseSigningData extracts domain and message hashes from EIP-712 signing data
func parseSigningData(signingData string) ([]byte, []byte, error) {
	// Remove 0x prefix if present
	if strings.HasPrefix(signingData, "0x") {
		signingData = signingData[2:]
	}

	// The signing data should be 66 bytes (132 hex characters)
	// First 2 bytes are EIP-712 prefix (0x1901)
	// Next 32 bytes are domain hash
	// Last 32 bytes are message hash
	if len(signingData) != 132 {
		return nil, nil, fmt.Errorf("expected 132 hex characters, got %d", len(signingData))
	}

	hash, err := hex.DecodeString(signingData)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to decode hex: %v", err)
	}

	// Skip the first 2 bytes (EIP-712 prefix 0x1901)
	domainHash := hash[2:34]
	messageHash := hash[34:66]

	return domainHash, messageHash, nil
}
