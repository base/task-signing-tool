# Task signing

The tool validates and signs contract-deployments Tasks.

## Language

**Task**:
A folder under `active/evm/tasks/<id>` in contract-deployments with per-network config, validations, and signatures. Its README carries execution status; the UI calls it an "upgrade".

**Validation profile**:
A JSON file in `config/<network>/validations/` describing expected state changes and hashes and the hardware-wallet `ledgerId` for one signer role. The UI calls it "config" or "user type".
