package chain

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/consensus"
	"github.com/ethereum/go-ethereum/core"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/params"
)

type chainContext struct {
	config *params.ChainConfig
	client *ethclient.Client
}

func NewChainContext(config *params.ChainConfig, client *ethclient.Client) core.ChainContext {
	return &chainContext{config: config, client: client}
}

func (c *chainContext) Config() *params.ChainConfig {
	return c.config
}

func (c *chainContext) Engine() consensus.Engine {
	return nil
}

func (c *chainContext) GetHeader(hash common.Hash, number uint64) *types.Header {
	header, err := c.client.HeaderByNumber(context.Background(), big.NewInt(int64(number)))
	if err != nil {
		return nil
	}
	return header
}
