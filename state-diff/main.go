package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/url"
	"os"

	"github.com/base/task-signing-tool/state-diff/internal/command"
	"github.com/base/task-signing-tool/state-diff/internal/evm"
	"github.com/base/task-signing-tool/state-diff/internal/state"
	"github.com/base/task-signing-tool/state-diff/internal/template"
	"github.com/base/task-signing-tool/state-diff/internal/transaction"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	var prefix string
	var suffix string
	var workdir string
	var rpcURL string
	var outputFile string

	flag.StringVar(&prefix, "prefix", "vvvvvvvv", "String that prefixes the data to be signed")
	flag.StringVar(&suffix, "suffix", "^^^^^^^^", "String that suffixes the data to be signed")
	flag.StringVar(&workdir, "workdir", ".", "Directory in which to run the subprocess")
	flag.StringVar(&rpcURL, "rpc", "", "RPC URL to connect to")
	flag.StringVar(&outputFile, "o", "", "Output file path")
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

	// Original behavior: run script to extract data
	domainHash, messageHash, finalTenderlyLink, err := command.GetDomainAndMessageHash("", prefix, suffix, workdir)
	if err != nil {
		log.Fatalf("Error getting domain and message hashes: %v", err)
	}

	u, err := url.Parse(finalTenderlyLink)
	if err != nil {
		log.Fatalf("Failed to parse link: %v", err)
	}

	m, err := url.ParseQuery(u.RawQuery)
	if err != nil {
		log.Fatal("Failed to parse link query params", err)
	}

	tx, err := transaction.CreateTransaction(client, chainID, m)
	if err != nil {
		log.Fatal("Failed to create transaction", err)
	}

	overrides := m["stateOverrides"][0]

	evm, err := evm.NewEVM(client, chainID, overrides)
	if err != nil {
		log.Fatal("Failed to create evm: ", err)
	}

	sender := common.HexToAddress(m["from"][0])

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
		fmt.Println("<<<RESULT>>>")
		fmt.Println(string(jsonBytes))
	}
}
