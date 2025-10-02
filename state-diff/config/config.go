package config

import _ "embed"

//go:embed contracts.yaml
var EmbeddedConfigFile []byte
