package state

import (
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"sync"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/state"
	"github.com/ethereum/go-ethereum/core/stateless"
	"github.com/ethereum/go-ethereum/core/tracing"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/core/vm"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/ethdb"
	"github.com/ethereum/go-ethereum/params"
	"github.com/ethereum/go-ethereum/trie/utils"
	"github.com/holiman/uint256"
)

var DEBUG_LOGGING = false

type StorageOverride struct {
	Key   common.Hash `json:"key"`
	Value common.Hash `json:"value"`
}

type Override struct {
	ContractAddress common.Address    `json:"contractAddress"`
	Storage         []StorageOverride `json:"storage"`
}

type StorageDiff struct {
	Key         common.Hash
	ValueBefore common.Hash
	ValueAfter  common.Hash
	Preimage    string
	isSet       bool
}

type StateDiff struct {
	Address       common.Address
	BalanceBefore *uint256.Int
	BalanceAfter  *uint256.Int
	NonceSeen     bool
	NonceBefore   uint64
	NonceAfter    uint64
	StorageDiffs  map[common.Hash]StorageDiff
}

// CachingStateDB implements a state database that caches fetched state data
type CachingStateDB struct {
	client    *ethclient.Client
	blockNum  *big.Int
	db        ethdb.Database
	cache     *sync.Map
	diffs     map[common.Address]StateDiff
	preimages map[common.Hash]string
	Overrides []Override
}

// NewCachingStateDB creates a new caching state database
func NewCachingStateDB(client *ethclient.Client, blockNum *big.Int, db ethdb.Database) vm.StateDB {
	return &CachingStateDB{
		client:    client,
		blockNum:  blockNum,
		db:        db,
		cache:     &sync.Map{},
		diffs:     make(map[common.Address]StateDiff),
		preimages: make(map[common.Hash]string),
	}
}

func (db *CachingStateDB) GetPreimage(h common.Hash) string {
	return db.preimages[h]
}

func (db *CachingStateDB) SetOverrides(overrides string) {
	var decodedOverrides []Override
	err := json.Unmarshal([]byte(overrides), &decodedOverrides)
	if err != nil {
		fmt.Printf("Error unmarshalling overrides JSON: %v\n", err)
		return
	}

	db.applyOverrides(decodedOverrides)
}

func (db *CachingStateDB) GetOverrides() []Override {
	return db.Overrides
}

func (db *CachingStateDB) applyOverrides(overrides []Override) {
	db.Overrides = overrides

	for _, override := range overrides {
		for _, storageOverride := range override.Storage {
			db.setState(override.ContractAddress, storageOverride.Key, storageOverride.Value, true)
		}
	}
}

func NewStateDiff(addr common.Address) StateDiff {
	return StateDiff{
		Address:       addr,
		BalanceBefore: nil,
		BalanceAfter:  nil,
		NonceSeen:     false,
		NonceBefore:   0,
		NonceAfter:    0,
		StorageDiffs:  make(map[common.Hash]StorageDiff),
	}
}

func (d *StateDiff) Print() {
	fmt.Printf("StateDiff: %s\n", d.Address.Hex())
	fmt.Printf("  BalanceBefore: %s\n", d.BalanceBefore.String())
	fmt.Printf("  BalanceAfter: %s\n", d.BalanceAfter.String())
	fmt.Printf("  NonceBefore: %d\n", d.NonceBefore)
	fmt.Printf("  NonceAfter: %d\n", d.NonceAfter)

	for _, storageDiff := range d.StorageDiffs {
		storageDiff.Print()
	}
}

func (s *StorageDiff) Print() {
	fmt.Printf("StorageDiff: %s\n", s.Key.Hex())
	fmt.Printf("  ValueBefore: %s\n", s.ValueBefore.Hex())
	fmt.Printf("  ValueAfter: %s\n", s.ValueAfter.Hex())
}

// GetBalance fetches the balance for an address, using cache if available
func (db *CachingStateDB) GetBalance(addr common.Address) *uint256.Int {
	cacheKey := getBalanceCacheKey(addr)

	// Try to get from cache first
	if balance, ok := db.cache.Load(cacheKey); ok {
		return balance.(*uint256.Int)
	}

	// Fetch from RPC if not in cache
	balance, err := db.client.BalanceAt(context.Background(), addr, db.blockNum)
	if err != nil {
		return uint256.NewInt(0)
	}

	// Convert to uint256 and store in cache
	balanceU256 := new(uint256.Int)
	balanceU256.SetFromBig(balance)
	db.cache.Store(cacheKey, balanceU256)
	return balanceU256
}

// GetCode fetches the code for a contract address, using cache if available
func (db *CachingStateDB) GetCode(addr common.Address) []byte {
	cacheKey := getCodeCacheKey(addr)

	// Try to get from cache first
	if code, ok := db.cache.Load(cacheKey); ok {
		return code.([]byte)
	}

	// Fetch from RPC if not in cache
	code, err := db.client.CodeAt(context.Background(), addr, db.blockNum)
	if err != nil {
		return nil
	}

	// Store in cache
	db.cache.Store(cacheKey, code)
	return code
}

// GetState fetches storage value for an address at a specific key, using cache if available
func (db *CachingStateDB) GetState(addr common.Address, key common.Hash) common.Hash {
	// Create a composite key for storage
	storageKey := getStorageCacheKey(addr, key)

	// Try to get from cache first
	if value, ok := db.cache.Load(storageKey); ok {
		return value.(common.Hash)
	}

	// Fetch from RPC if not in cache
	value, err := db.client.StorageAt(context.Background(), addr, key, db.blockNum)
	if err != nil {
		fmt.Println("ERROR FROM GET STATE!!!!!", err)
		return common.Hash{}
	}

	// Store in cache
	db.cache.Store(storageKey, common.BytesToHash(value))
	return common.BytesToHash(value)
}

// GetNonce fetches the nonce for an address, using cache if available
func (db *CachingStateDB) GetNonce(addr common.Address) uint64 {
	cacheKey := getNonceCacheKey(addr)

	// Try to get from cache first
	if nonce, ok := db.cache.Load(cacheKey); ok {
		return nonce.(uint64)
	}

	// Fetch from RPC if not in cache
	nonce, err := db.client.NonceAt(context.Background(), addr, db.blockNum)
	if err != nil {
		return 0
	}

	// Store in cache
	db.cache.Store(cacheKey, nonce)
	return nonce
}

func (db *CachingStateDB) SubBalance(addr common.Address, amount *uint256.Int, _ tracing.BalanceChangeReason) uint256.Int {
	stateDiff := db.getStateDiff(addr)

	balanceBefore := db.GetBalance(addr)
	if stateDiff.BalanceBefore == nil {
		stateDiff.BalanceBefore = balanceBefore
	}

	if stateDiff.BalanceAfter == nil {
		stateDiff.BalanceAfter = new(uint256.Int)
	}
	stateDiff.BalanceAfter.Sub(balanceBefore, amount)

	db.diffs[addr] = stateDiff
	db.cache.Store(getBalanceCacheKey(addr), stateDiff.BalanceAfter)
	return *balanceBefore
}

func (db *CachingStateDB) AddBalance(addr common.Address, amount *uint256.Int, _ tracing.BalanceChangeReason) uint256.Int {
	stateDiff := db.getStateDiff(addr)

	balanceBefore := db.GetBalance(addr)
	if stateDiff.BalanceBefore == nil {
		stateDiff.BalanceBefore = balanceBefore
	}

	if stateDiff.BalanceAfter == nil {
		stateDiff.BalanceAfter = new(uint256.Int)
	}
	stateDiff.BalanceAfter.Add(balanceBefore, amount)

	db.diffs[addr] = stateDiff
	db.cache.Store(getBalanceCacheKey(addr), stateDiff.BalanceAfter)
	return *balanceBefore
}

func (db *CachingStateDB) SetState(addr common.Address, key, value common.Hash) common.Hash {
	return db.setState(addr, key, value, false)
}

func (db *CachingStateDB) setState(addr common.Address, key, value common.Hash, isOverride bool) common.Hash {
	stateDiff := db.getStateDiff(addr)
	storageDiff := stateDiff.getStorageDiff(key)

	valueBefore := db.GetState(addr, key)
	if isOverride {
		valueBefore = value
	}

	if !storageDiff.isSet {
		storageDiff.ValueBefore = valueBefore
		storageDiff.isSet = true
	}

	storageDiff.ValueAfter = value
	storageDiff.Preimage = db.preimages[key]
	stateDiff.StorageDiffs[key] = storageDiff
	db.diffs[addr] = stateDiff
	db.cache.Store(getStorageCacheKey(addr, key), value)
	return valueBefore
}

// SetNonce tracks state changes
func (db *CachingStateDB) SetNonce(addr common.Address, nonce uint64, _ tracing.NonceChangeReason) {
	stateDiff := db.getStateDiff(addr)

	nonceBefore := db.GetNonce(addr)
	if !stateDiff.NonceSeen {
		stateDiff.NonceBefore = nonceBefore
		stateDiff.NonceSeen = true
	}

	stateDiff.NonceAfter = nonce
	db.diffs[addr] = stateDiff

	// Update the cache
	db.cache.Store(getNonceCacheKey(addr), nonce)
}

// GetStateDiffs returns all the state changes from the simulation
func (db *CachingStateDB) GetStateDiffs() []StateDiff {
	diffs := make([]StateDiff, 0, len(db.diffs))
	for _, diff := range db.diffs {
		diffs = append(diffs, diff)
	}
	return diffs
}

func getNonceCacheKey(addr common.Address) common.Hash {
	return common.BytesToHash(addr.Bytes())
}

func getBalanceCacheKey(addr common.Address) common.Hash {
	return crypto.Keccak256Hash(append(addr.Bytes(), []byte("balance")...))
}

func getCodeCacheKey(addr common.Address) common.Hash {
	return crypto.Keccak256Hash(append(addr.Bytes(), []byte("code")...))
}

func getStorageCacheKey(addr common.Address, key common.Hash) common.Hash {
	return crypto.Keccak256Hash(append(addr.Bytes(), key.Bytes()...))
}

func (db *CachingStateDB) getStateDiff(addr common.Address) StateDiff {
	stateDiff, ok := db.diffs[addr]
	if !ok {
		stateDiff = NewStateDiff(addr)
	}

	return stateDiff
}

func (diff *StateDiff) getStorageDiff(key common.Hash) StorageDiff {
	storageDiff, ok := diff.StorageDiffs[key]
	if !ok {
		storageDiff = StorageDiff{
			Key: key,
		}
	}

	return storageDiff
}

func (db *CachingStateDB) AddPreimage(hash common.Hash, preimage []byte) {
	db.preimages[hash] = common.Bytes2Hex(preimage)
}

func (db *CachingStateDB) GetCodeHash(addr common.Address) common.Hash {
	// Retrieve code from cache or RPC
	code := db.GetCode(addr)
	if len(code) == 0 {
		return common.Hash{}
	}
	return crypto.Keccak256Hash(code)
}
func (db *CachingStateDB) GetCodeSize(addr common.Address) int {
	code := db.GetCode(addr)
	return len(code)
}

// AddAddressToAccessList adds an address to the access list
func (db *CachingStateDB) AddAddressToAccessList(addr common.Address) {
	if DEBUG_LOGGING {
		fmt.Println("AddAddressToAccessList", addr)
	}
}

// AddSlotToAccessList adds a slot to the access list
func (db *CachingStateDB) AddSlotToAccessList(addr common.Address, slot common.Hash) {
	if DEBUG_LOGGING {
		fmt.Println("AddSlotToAccessList", addr, slot)
	}
}

// AddressInAccessList checks if an address is in the access list
func (db *CachingStateDB) AddressInAccessList(addr common.Address) bool {
	if DEBUG_LOGGING {
		fmt.Println("AddressInAccessList", addr)
	}
	return true
}

// GetTransientState gets the transient state for an address and key
func (db *CachingStateDB) GetTransientState(addr common.Address, key common.Hash) common.Hash {
	if DEBUG_LOGGING {
		fmt.Println("GetTransientState", addr, key)
	}
	return common.Hash{}
}

// Prepare prepares the state database for a new transaction
func (db *CachingStateDB) Prepare(rules params.Rules, sender, coinbase common.Address, dest *common.Address, precompiles []common.Address, txAccesses types.AccessList) {
	if DEBUG_LOGGING {
		fmt.Println("Prepare")
	}
}

// Selfdestruct6780 implements the EIP-6780 selfdestruct behavior
func (db *CachingStateDB) SelfDestruct6780(addr common.Address) (uint256.Int, bool) {
	if DEBUG_LOGGING {
		fmt.Println("SelfDestruct6780", addr)
	}
	return *uint256.NewInt(0), false
}

// SetTransientState sets the transient state for an address and key
func (db *CachingStateDB) SetTransientState(addr common.Address, key, value common.Hash) {
	if DEBUG_LOGGING {
		fmt.Println("SetTransientState", addr, key, value)
	}
}

// SlotInAccessList checks if a slot is in the access list
func (db *CachingStateDB) SlotInAccessList(addr common.Address, slot common.Hash) (bool, bool) {
	if DEBUG_LOGGING {
		fmt.Println("SlotInAccessList", addr, slot)
	}
	return true, true
}

// Required vm.StateDB interface methods that we don't need to implement for simulation
func (db *CachingStateDB) CreateAccount(addr common.Address) {
	if DEBUG_LOGGING {
		fmt.Println("CreateAccount", addr)
	}
}
func (db *CachingStateDB) GetRefund() uint64 {
	if DEBUG_LOGGING {
		fmt.Println("GetRefund")
	}
	return 0
}
func (db *CachingStateDB) GetCommittedState(addr common.Address, key common.Hash) common.Hash {
	if DEBUG_LOGGING {
		fmt.Printf("GetCommittedState(%s, %s)\n", addr, key)
	}
	return common.Hash{}
}
func (db *CachingStateDB) SetCode(common.Address, []byte) []byte {
	if DEBUG_LOGGING {
		fmt.Println("SetCode")
	}
	return nil
}
func (db *CachingStateDB) AddRefund(amt uint64) {
	if DEBUG_LOGGING {
		fmt.Println("AddRefund", amt)
	}
}
func (db *CachingStateDB) SubRefund(amt uint64) {
	if DEBUG_LOGGING {
		fmt.Println("SubRefund", amt)
	}
}
func (db *CachingStateDB) SelfDestruct(addr common.Address) uint256.Int {
	if DEBUG_LOGGING {
		fmt.Println("SelfDestruct", addr)
	}
	return *uint256.NewInt(0)
}
func (db *CachingStateDB) HasSelfDestructed(addr common.Address) bool {
	if DEBUG_LOGGING {
		fmt.Println("HasSelfDestructed", addr)
	}
	return false
}
func (db *CachingStateDB) Exist(addr common.Address) bool {
	if DEBUG_LOGGING {
		fmt.Println("Exist", addr)
	}
	return true
}
func (db *CachingStateDB) Empty(addr common.Address) bool {
	if DEBUG_LOGGING {
		fmt.Println("Empty", addr)
	}
	return false
}
func (db *CachingStateDB) RevertToSnapshot(amt int) {
	if DEBUG_LOGGING {
		fmt.Println("RevertToSnapshot", amt)
	}
}
func (db *CachingStateDB) Snapshot() int {
	if DEBUG_LOGGING {
		fmt.Println("Snapshot")
	}
	return 0
}
func (db *CachingStateDB) AddLog(*types.Log) {
	if DEBUG_LOGGING {
		fmt.Println("AddLog")
	}
}

func (db *CachingStateDB) AccessEvents() *state.AccessEvents {
	if DEBUG_LOGGING {
		fmt.Println("AccessEvents")
	}
	return nil
}

func (db *CachingStateDB) CreateContract(addr common.Address) {
	if DEBUG_LOGGING {
		fmt.Println("CreateContract", addr)
	}
}

func (db *CachingStateDB) Finalise(deleteEmptyObjects bool) {
	if DEBUG_LOGGING {
		fmt.Println("Finalise")
	}
}

func (db *CachingStateDB) GetStorageRoot(addr common.Address) common.Hash {
	if DEBUG_LOGGING {
		fmt.Println("GetStorageRoot", addr)
	}
	return common.Hash{}
}

func (db *CachingStateDB) PointCache() *utils.PointCache {
	if DEBUG_LOGGING {
		fmt.Println("PointCache")
	}
	return nil
}

func (db *CachingStateDB) Witness() *stateless.Witness {
	if DEBUG_LOGGING {
		fmt.Println("Witness")
	}
	return nil
}
