package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/base/task-signing-tool/state-diff/internal/command"
	"github.com/base/task-signing-tool/state-diff/internal/processor"
	"github.com/base/task-signing-tool/state-diff/internal/template"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/holiman/uint256"
)

func main() {
	var workdir string
	var rpcURL string
	var outputFile string

	flag.StringVar(&workdir, "workdir", ".", "Directory in which to run the subprocess")
	flag.StringVar(&rpcURL, "rpc", "", "RPC URL to connect to")
	flag.StringVar(&outputFile, "o", "", "Output file path")
	flag.Parse()

	if rpcURL == "" {
		fmt.Println("Error: RPC URL is required")
		os.Exit(1)
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		fmt.Printf("Failed to connect to the Ethereum client: %v\n", err)
		os.Exit(1)
	}

	chainID, err := client.ChainID(context.Background())
	if err != nil {
		fmt.Printf("Failed to get chain ID: %v\n", err)
		os.Exit(1)
	}

	err = command.RunSimulation(workdir)
	if err != nil {
		log.Fatalf("Error getting domain and message hashes: %v", err)
	}

	diff, err := processor.ReadEncodedStateDiff(workdir)
	if err != nil {
		log.Panic("Error reading encoded state diff", err)
	}

	domainHash, messageHash, err := processor.GetDomainAndMessageHash(diff.DataToSign)
	if err != nil {
		log.Fatalf("Error getting domain and message hashes: %v", err)
	}

	decodedPayload, err := processor.DecodeOverrides(diff.Overrides)
	if err != nil {
		log.Panic("Error decoding payload", err)
	}

	decodedDiff, err := processor.DecodeStateDiff(diff.StateDiff)
	if err != nil {
		log.Panic("Error decoding encoded diff", err)
	}

	diffsMap := map[common.Address]template.StateDiff{}
	for _, d := range decodedDiff {
		for _, a := range d.StorageAccesses {
			if a.IsWrite {
				// Check if we've registered this account in diffsMap
				acct, ok := diffsMap[a.Account]
				if !ok {
					oldBalU256 := new(uint256.Int)
					oldBalU256.SetFromBig(d.OldBalance)
					newBalU256 := new(uint256.Int)
					newBalU256.SetFromBig(d.NewBalance)
					acct = template.StateDiff{
						Address:       a.Account,
						BalanceBefore: oldBalU256,
						BalanceAfter:  newBalU256,
						NonceSeen:     false,
						NonceBefore:   d.OldNonce,
						NonceAfter:    d.NewNonce,
						StorageDiffs:  map[common.Hash]template.StorageDiff{},
					}
				}

				diff, ok := acct.StorageDiffs[a.Slot]
				if !ok {
					diff = template.StorageDiff{
						Key:         a.Slot,
						ValueBefore: a.PreviousValue,
						ValueAfter:  a.NewValue,
						Preimage:    "",
					}
				}

				diff.ValueAfter = a.NewValue

				acct.StorageDiffs[a.Slot] = diff

				if diff.ValueBefore.Cmp(diff.ValueAfter) == 0 {
					delete(acct.StorageDiffs, a.Slot)
				}
				diffsMap[a.Account] = acct
				if len(acct.StorageDiffs) == 0 {
					delete(diffsMap, a.Account)
				}
			}
		}
	}

	decodedPreimages, err := processor.DecodePreimages(diff.Preimages)
	if err != nil {
		log.Panic("Error decoding preimages", err)
	}

	parentMap := map[common.Hash]common.Hash{}
	for _, preimage := range decodedPreimages {
		parentMap[preimage.Slot] = preimage.Parent
	}

	diffs := []template.StateDiff{}
	for _, d := range diffsMap {
		diffs = append(diffs, d)
	}

	fileGenerator, err := template.NewFileGenerator(chainID.String())
	if err != nil {
		fmt.Printf("Error creating file generator: %v\n", err)
		os.Exit(1)
	}

	jsonResult, err := fileGenerator.BuildValidationJSON("", "", "", "", diff.TargetSafe, decodedPayload.StateOverrides, diffs, domainHash, messageHash, parentMap)
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
