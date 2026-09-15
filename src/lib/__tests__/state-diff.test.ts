import { describe, expect, it } from '@jest/globals';
import { Address, Hex } from 'viem';
import {
  addressMappingSlot,
  arrayDataSlot,
  collectMappingKeys,
  ContractCfg,
  resolveSlot,
  SlotCfg,
} from '../state-diff';

const slot = (n: number): Hex => `0x${n.toString(16).padStart(64, '0')}` as Hex;

const offsetSlot = (base: Hex, i: number): Hex =>
  `0x${(BigInt(base) + BigInt(i)).toString(16).padStart(64, '0')}` as Hex;

const cfg = (summary: string, extra: Partial<SlotCfg> = {}): SlotCfg => ({
  type: 'uint256',
  summary,
  overrideMeaning: '',
  allowDifference: false,
  allowOverrideDifference: false,
  ...extra,
});

const APPROVED_HASHES_SLOT = slot(8);

const safe: ContractCfg = {
  name: 'Proxy Admin Owner - Zeronet',
  slots: {
    [slot(5)]: cfg('Increments the nonce'),
    [APPROVED_HASHES_SLOT]: cfg('Sets an approval for this transaction'),
  },
};

const protocolVersions: ContractCfg = {
  name: 'ProtocolVersions - Zeronet',
  slots: {
    [slot(1)]: cfg('Updates the number of registered upgrades (_timestamps length).', {
      type: 'uint64[]',
      elements: {
        label: '_timestamps',
        summary: 'L2 activation timestamps for these upgrade ids.',
        type: 'uint64',
        perSlot: 4,
        maxSlots: 32,
      },
    }),
    [slot(2)]: cfg('Updates the length of the schedule commitment hash chain.', {
      type: 'bytes32[]',
      elements: {
        label: '_upgradeScheduleId',
        summary: 'schedule commitment hash-chain link.',
        type: 'bytes32',
        maxSlots: 128,
      },
    }),
  },
};

// Verified against the Cobalt upgrade validation file for Zeronet: `cast keccak` of
// `abi.encode(uint256(1))` and `abi.encode(uint256(2))`.
const TIMESTAMPS_BASE = '0xb10e2d527612073b26eecdfd717e6a320cf44b4afac2b0732d9fcbe2b7fa0cf6';
const SCHEDULE_ID_BASE = '0x405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace';

describe('slot derivation helpers', () => {
  it('matches the array data slots Solidity uses', () => {
    expect(arrayDataSlot(slot(1))).toBe(TIMESTAMPS_BASE);
    expect(arrayDataSlot(slot(2))).toBe(SCHEDULE_ID_BASE);
  });

  it('matches the mapping slot Solidity uses for an address key', () => {
    // From the Cobalt base-signer validation file: the msg.sender approval override on the
    // CB Signer Safe is keccak256(abi.encode(safeTxHash, keccak256(abi.encode(sender, 8)))).
    expect(
      addressMappingSlot('0x2c1475476B586d66a85bC65A5aB396BBbAa4f3aD', APPROVED_HASHES_SLOT)
    ).toBe('0x960f4db936d2c46564d4489ec93daed037344f5653edc02f872d6d03a8e6fb9d');
  });
});

describe('resolveSlot', () => {
  it('returns a directly declared slot', () => {
    expect(resolveSlot(safe, slot(5), new Map()).summary).toBe('Increments the nonce');
  });

  it('walks recorded mapping preimages to the declared base slot', () => {
    const derived = '0xabc0000000000000000000000000000000000000000000000000000000000000' as Hex;
    const parentMap = new Map<Hex, Hex>([[derived, APPROVED_HASHES_SLOT]]);

    expect(resolveSlot(safe, derived, parentMap).summary).toBe(
      'Sets an approval for this transaction'
    );
  });

  it('derives the nested mapping hop Foundry does not record', () => {
    // A Safe's approvedHashes[owner][hash] is two levels deep, but only the fully derived slot
    // is accessed, so Foundry records that slot's parent and nothing links it back to slot 8.
    const owner: Address = '0x2c1475476B586d66a85bC65A5aB396BBbAa4f3aD';
    const intermediate = addressMappingSlot(owner, APPROVED_HASHES_SLOT);
    const derived = '0x22d07ae145e29a1354330c3907e8569a367528393f8a5a0438bc67b7b9c15f52' as Hex;
    const parentMap = new Map<Hex, Hex>([[derived, intermediate]]);

    expect(resolveSlot(safe, derived, parentMap).summary).toBe('<<Summary>>');
    expect(resolveSlot(safe, derived, parentMap, { mappingKeys: [owner] }).summary).toBe(
      'Sets an approval for this transaction'
    );
  });

  it('labels an unpacked array element with its index', () => {
    const first = offsetSlot(SCHEDULE_ID_BASE, 1);
    const last = offsetSlot(SCHEDULE_ID_BASE, 13);

    expect(resolveSlot(protocolVersions, first, new Map()).summary).toBe(
      '_upgradeScheduleId[1]: schedule commitment hash-chain link.'
    );
    expect(resolveSlot(protocolVersions, last, new Map()).summary).toBe(
      '_upgradeScheduleId[13]: schedule commitment hash-chain link.'
    );
    expect(resolveSlot(protocolVersions, first, new Map()).type).toBe('bytes32');
  });

  it('labels a packed array element with the index range it holds', () => {
    expect(resolveSlot(protocolVersions, offsetSlot(TIMESTAMPS_BASE, 1), new Map()).summary).toBe(
      '_timestamps[4..7]: L2 activation timestamps for these upgrade ids.'
    );
  });

  it('clamps the final packed slot to the declared array length', () => {
    // 13 entries packed four per slot leaves only index 12 in the fourth slot.
    const slotValues = new Map<Hex, Hex>([[slot(1), slot(13)]]);

    expect(
      resolveSlot(protocolVersions, offsetSlot(TIMESTAMPS_BASE, 3), new Map(), { slotValues })
        .summary
    ).toBe('_timestamps[12]: L2 activation timestamps for these upgrade ids.');
  });

  it('ignores an element slot past the declared array length', () => {
    const slotValues = new Map<Hex, Hex>([[slot(2), slot(3)]]);

    expect(
      resolveSlot(protocolVersions, offsetSlot(SCHEDULE_ID_BASE, 7), new Map(), { slotValues })
        .summary
    ).toBe('<<Summary>>');
  });

  it('ignores an element slot beyond maxSlots', () => {
    expect(resolveSlot(protocolVersions, offsetSlot(TIMESTAMPS_BASE, 32), new Map()).summary).toBe(
      '<<Summary>>'
    );
  });

  it('falls back to placeholders without allowing a difference', () => {
    const unknown = resolveSlot(safe, slot(99), new Map());

    expect(unknown.summary).toBe('<<Summary>>');
    expect(unknown.overrideMeaning).toBe('<<OverrideMeaning>>');
    expect(unknown.allowDifference).toBe(false);
    expect(unknown.allowOverrideDifference).toBe(false);
  });

  it('terminates when preimages describe a cycle', () => {
    const a = slot(101);
    const b = slot(102);
    const parentMap = new Map<Hex, Hex>([
      [a, b],
      [b, a],
    ]);

    expect(resolveSlot(safe, a, parentMap).summary).toBe('<<Summary>>');
  });

  it('does not report an array element as allowing a difference by default', () => {
    expect(
      resolveSlot(protocolVersions, offsetSlot(SCHEDULE_ID_BASE, 1), new Map()).allowDifference
    ).toBe(false);
  });
});

describe('collectMappingKeys', () => {
  it('collects the sender, target, diff and override addresses', () => {
    const keys = collectMappingKeys(
      {
        from: '0x2c1475476B586d66a85bC65A5aB396BBbAa4f3aD',
        to: '0x3d59999977e0896ee1f8783bB8251DF16fb483E9',
        stateOverrides: [
          {
            contractAddress: '0xc4c0ad998b5dfa4cf4b298970f21b9015a5ee7ba',
            overrides: [],
          },
        ],
      },
      [{ address: '0x856611ed7e07d83243b15e93f6321f2df6865852' }]
    );

    expect(keys).toEqual([
      '0x2c1475476B586d66a85bC65A5aB396BBbAa4f3aD',
      '0x3d59999977e0896ee1f8783bB8251DF16fb483E9',
      '0x856611eD7E07D83243b15E93f6321f2df6865852',
      '0xC4c0aD998B5DfA4CF4B298970F21b9015a5eE7bA',
    ]);
  });

  it('de-duplicates addresses that appear in several roles', () => {
    const repeated: Address = '0x856611eD7E07D83243b15E93f6321f2df6865852';
    const keys = collectMappingKeys({ from: repeated, to: repeated, stateOverrides: [] }, [
      { address: repeated.toLowerCase() },
    ]);

    expect(keys).toEqual([repeated]);
  });
});
