package command

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

// Most of this was pulled from https://github.com/base/eip712sign
func RunSimulation(workdir string) error {
	_, err := readInput(workdir)
	if err != nil {
		return fmt.Errorf("error reading input: %w", err)
	}
	return nil
}

func readInput(workdir string) ([]byte, error) {
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
