package command

import (
	"bytes"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/ethereum/go-ethereum/common"
)

// Most of this was pulled from https://github.com/base/eip712sign
func GetDomainAndMessageHash(data, prefix, suffix, workdir string) ([]byte, []byte, string, error) {
	input, err := readInput(data, workdir)
	if err != nil {
		return nil, nil, "", fmt.Errorf("error reading input: %w", err)
	}

	return parseInput(input, prefix, suffix)
}

func readInput(data, workdir string) ([]byte, error) {
	if data != "" {
		return []byte(data), nil
	}

	if flag.NArg() == 0 {
		return io.ReadAll(os.Stdin)
	}

	args := flag.Args()
	fmt.Printf("Running '%s\n", strings.Join(args, " "))
	return run(workdir, args[0], args[1:]...)
}

func run(workdir, name string, args ...string) ([]byte, error) {
	cmd := exec.Command(name, args...)
	cmd.Dir = workdir

	var buffer bytes.Buffer
	cmd.Stdout = io.MultiWriter(os.Stdout, &buffer)
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	return buffer.Bytes(), err
}

func parseInput(input []byte, prefix string, suffix string) ([]byte, []byte, string, error) {
	rawInput := input

	if index := strings.Index(string(input), prefix); prefix != "" && index >= 0 {
		input = input[index+len(prefix):]
	}
	if index := strings.Index(string(input), suffix); suffix != "" && index >= 0 {
		input = input[:index]
	}

	fmt.Println()
	hash := common.FromHex(strings.TrimSpace(string(input)))
	if len(hash) != 66 {
		return nil, nil, "", fmt.Errorf("expected EIP-712 hex string with 66 bytes, got %d bytes, value: %s", len(input), string(input))
	}

	domainHash := hash[2:34]
	messageHash := hash[34:66]
	fmt.Printf("Domain hash: 0x%s\n", hex.EncodeToString(domainHash))
	fmt.Printf("Message hash: 0x%s\n", hex.EncodeToString(messageHash))

	tenderlyPrefix := "https://dashboard.tenderly.co"
	tenderlyInput := rawInput
	if index := strings.Index(string(tenderlyInput), tenderlyPrefix); index >= 0 {
		tenderlyInput = tenderlyInput[index:]
	}
	// Find end of url - should be a space or newline
	if index := strings.IndexAny(string(tenderlyInput), " \n"); index >= 0 {
		tenderlyInput = tenderlyInput[:index]
	}

	tenderlyLink := strings.TrimSpace(string(tenderlyInput))

	extraDataPrefix := "Insert the following hex into the 'Raw input data' field:"
	extraDataInput := rawInput
	extraDataIndex := strings.Index(string(extraDataInput), extraDataPrefix)
	if extraDataIndex >= 0 {
		extraDataInput = extraDataInput[extraDataIndex:]
		if index := strings.Index(string(extraDataInput), "0x"); index >= 0 {
			extraDataInput = extraDataInput[index:]
		}

		// Find end of extra data - should be a space or newline
		if index := strings.IndexAny(string(extraDataInput), "\n"); index >= 0 {
			extraDataInput = extraDataInput[:index]
		}

		tenderlyLink += "&rawFunctionInput=" + string(extraDataInput)
	}

	fmt.Printf("Tenderly link: %s\n", tenderlyLink)

	return domainHash, messageHash, tenderlyLink, nil
}
