package template

// JSON types that match TypeScript validation tool expectations
type ValidationResult struct {
	DomainHash     string          `json:"domain_hash"`
	MessageHash    string          `json:"message_hash"`
	TargetSafe     string          `json:"target_safe"`
	StateOverrides []StateOverride `json:"state_overrides"`
	StateChanges   []StateChange   `json:"state_changes"`
}

// JSON types that match the expected validation format (base-nested.json)
type ValidationResultFormatted struct {
	TaskName                          string                           `json:"task_name"`
	ScriptName                        string                           `json:"script_name"`
	Signature                         string                           `json:"signature"`
	Args                              string                           `json:"args"`
	ExpectedDomainAndMessageHashes    DomainAndMessageHashes           `json:"expected_domain_and_message_hashes"`
	ExpectedNestedHash                string                           `json:"expected_nested_hash"`
	StateOverrides                    []StateOverride                  `json:"state_overrides"`
	StateChanges                      []StateChange                    `json:"state_changes"`
}

type DomainAndMessageHashes struct {
	Address     string `json:"address"`
	DomainHash  string `json:"domain_hash"`
	MessageHash string `json:"message_hash"`
}

type StateOverride struct {
	Name      string     `json:"name"`
	Address   string     `json:"address"`
	Overrides []Override `json:"overrides"`
}

type StateChange struct {
	Name    string   `json:"name"`
	Address string   `json:"address"`
	Changes []Change `json:"changes"`
}

type Override struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

type Change struct {
	Key         string `json:"key"`
	Before      string `json:"before"`
	After       string `json:"after"`
	Description string `json:"description"`
}
