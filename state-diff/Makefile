LEDGER_ACCOUNT=1
# RPC=https://eth-mainnet.public.blastapi.io
# RPC=https://mainnet.base.org
RPC=https://ethereum-full-sepolia-k8s-dev.cbhq.net

SENDER=0x9986ccaf9e3de0ffef82a0f7fa3a06d5afe07252
# SENDER=0x24c3AE1AeDB8142D32BB6d3B988f5910F272D53b
# SENDER=0xf9e320f3dA12E68af219d9E2A490Dd649f6B177c
# SENDER=0x42d27eEA1AD6e22Af6284F609847CB3Cd56B9c64

.PHONY: run
run:
	go run . --rpc https://eth-mainnet.public.blastapi.io --format json --workdir /Users/jackchuma/projects/active/base-chain/sign-task/contract-deployments/mainnet/2025-10-02-test-upgrade -- forge script --rpc-url https://eth-mainnet.public.blastapi.io SwapOwner --sig "sign()" --sender 0x6CD3850756b7894774Ab715D136F9dD02837De50
# .PHONY: run
# run:
# 	go run . --rpc https://eth-mainnet.public.blastapi.io --format json \
# 	--workdir /Users/jackchuma/projects/active/base-chain/sign-task/contract-deployments/mainnet/2025-10-02-test-upgrade \
# 	-- forge script --rpc-url https://eth-mainnet.public.blastapi.io \
# 	SwapOwner --sig "sign()" --sender 0x6CD3850756b7894774Ab715D136F9dD02837De50

# .PHONY: run
# run:
# 	go run . --rpc $(RPC) -o validation.md \
# 	-- ./run.sh --sender $(SENDER)
