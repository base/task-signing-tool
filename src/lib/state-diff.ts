import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createPublicClient, http, decodeAbiParameters, Hex, Address } from 'viem';
import { BalanceChange, StateChange, StateOverride, TaskConfig } from './types/index';
import contractsCfg from './config/contracts.json';

type ParsedInput = {
  targetSafe: string;
  dataToSign: string; // concatenated 0x + domain(32B) + message(32B)
  stateDiff: string; // hex-encoded ABI tuple[]
  preimages: string; // hex-encoded ABI tuple[]
  overrides: string; // hex-encoded ABI tuple
};

type StorageOverrideDecoded = { key: Hex; value: Hex };
type StateOverrideDecoded = {
  contractAddress: string;
  overrides: readonly StorageOverrideDecoded[];
};
type PayloadDecoded = {
  from: Address;
  to: Address;
  data: Hex;
  stateOverrides: readonly StateOverrideDecoded[];
};

type VmSafeStorageAccess = {
  account: string;
  slot: Hex;
  isWrite: boolean;
  previousValue: Hex;
  newValue: Hex;
  reverted: boolean;
};

type VmSafeAccountAccess = {
  chainInfo: { forkId: bigint; chainId: bigint };
  kind: number;
  account: string;
  accessor: string;
  initialized: boolean;
  oldBalance: bigint;
  newBalance: bigint;
  deployedCode: Hex;
  value: bigint;
  data: Hex;
  reverted: boolean;
  storageAccesses: readonly VmSafeStorageAccess[];
  depth: bigint;
  oldNonce: bigint;
  newNonce: bigint;
};

type ParentPreimage = { slot: Hex; parent: Hex; key: Hex };

type SlotCfg = { type: string; summary: string; overrideMeaning: string; allowDifference: boolean };
type ContractCfg = { name: string; slots: Record<string, SlotCfg> };
type RawContractCfg = { name: string; slots?: string | Record<string, SlotCfg> };

export class StateDiffClient {
  async simulate(
    rpcUrl: string,
    forgeCmdParts: string[],
    workdir: string
  ): Promise<{
    result: TaskConfig;
    output: string;
  }> {
    const cmd = forgeCmdParts.join(' ');
    console.log(`🔧 Running forge in ${workdir}: ${cmd}`);

    const { stdout, stderr, code } = await this.runCommand(
      forgeCmdParts[0],
      forgeCmdParts.slice(1),
      workdir,
      120000
    );
    if (code !== 0) {
      throw new Error(
        `StateDiffClient::simulate: forge command failed with exit code ${code}.\nStdout: ${stdout}\nStderr: ${stderr}`
      );
    }

    if (stderr) {
      console.warn('⚠️ forge stderr:', stderr);
    }

    const client = createPublicClient({ transport: http(rpcUrl) });
    const chainIdHex = (await client.request({ method: 'eth_chainId' })) as string;
    const chainIdStr = BigInt(chainIdHex).toString();

    const parsed = await this.readEncodedStateDiff(workdir);
    this.deleteStateDiffFile(workdir);
    const { domainHash, messageHash } = this.getDomainAndMessageHashes(parsed.dataToSign);
    const payload = this.decodeOverrides(parsed.overrides);
    const decodedDiff = this.decodeStateDiff(parsed.stateDiff);
    const decodedPreimages = this.decodePreimages(parsed.preimages);

    const parentMap = new Map<Hex, Hex>();
    for (const p of decodedPreimages)
      parentMap.set(this.n(slotHex(p.slot)), this.n(slotHex(p.parent)));

    const config = this.loadAndResolveConfig();

    const diffsMap = this.buildDiffsMap(decodedDiff);
    const diffsList = Array.from(diffsMap.values());

    const balanceChanges = this.extractBalanceChanges(config, chainIdStr, decodedDiff);

    const result: TaskConfig = {
      cmd,
      ledgerId: 0,
      rpcUrl: rpcUrl,
      expectedDomainAndMessageHashes: {
        address: parsed.targetSafe,
        domainHash: domainHash,
        messageHash: messageHash,
      },
      stateOverrides: this.convertOverridesToJSON(
        config,
        chainIdStr,
        payload.stateOverrides,
        parentMap
      ),
      stateChanges: this.convertDiffsToJSON(config, chainIdStr, diffsList, parentMap),
      balanceChanges,
    };

    const output = `<<<RESULT>>>\n${JSON.stringify(result, null, 2)}`;
    console.log('✅ State-diff transformation completed');
    return { result, output };
  }

  private runCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise(resolve => {
      const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => child.kill(), timeoutMs);
      child.stdout.on('data', d => (stdout += d.toString()));
      child.stderr.on('data', d => (stderr += d.toString()));
      child.on('close', code => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, code });
      });
    });
  }

  private async readEncodedStateDiff(workdir: string): Promise<ParsedInput> {
    const p = path.join(workdir, 'stateDiff.json');
    if (!fs.existsSync(p)) {
      throw new Error(`stateDiff.json not found at ${p}`);
    }
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed as ParsedInput;
  }

  private deleteStateDiffFile(workdir: string) {
    const p = path.join(workdir, 'stateDiff.json');
    if (!fs.existsSync(p)) {
      throw new Error(`stateDiff.json not found at ${p}`);
    }
    try {
      fs.unlinkSync(p);
    } catch (err) {
      const message = String(err);
      throw new Error(`Failed to delete stateDiff.json at ${p}: ${message}`);
    }
  }

  private getDomainAndMessageHashes(dataToSign: string): { domainHash: Hex; messageHash: Hex } {
    const v = dataToSign.trim();
    if (!v.startsWith('0x')) throw new Error('dataToSign must be 0x-prefixed hex');
    const hex = v.slice(6);
    if (hex.length !== 128) {
      throw new Error(`expected 64 bytes (domain + message), got ${hex.length / 2} bytes`);
    }
    const domainHash = ('0x' + hex.slice(0, 64)) as Hex;
    const messageHash = ('0x' + hex.slice(64, 128)) as Hex;
    return { domainHash, messageHash };
  }

  private decodeOverrides(encoded: string): PayloadDecoded {
    const [tuple] = decodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'data', type: 'bytes' },
            {
              name: 'stateOverrides',
              type: 'tuple[]',
              components: [
                { name: 'contractAddress', type: 'address' },
                {
                  name: 'overrides',
                  type: 'tuple[]',
                  components: [
                    { name: 'key', type: 'bytes32' },
                    { name: 'value', type: 'bytes32' },
                  ],
                },
              ],
            },
          ],
        },
      ],
      encoded as Hex
    );
    return tuple;
  }

  private decodeStateDiff(encoded: string): readonly VmSafeAccountAccess[] {
    const [accesses] = decodeAbiParameters(
      [
        {
          type: 'tuple[]',
          components: [
            {
              name: 'chainInfo',
              type: 'tuple',
              components: [
                { name: 'forkId', type: 'uint256' },
                { name: 'chainId', type: 'uint256' },
              ],
            },
            { name: 'kind', type: 'uint8' },
            { name: 'account', type: 'address' },
            { name: 'accessor', type: 'address' },
            { name: 'initialized', type: 'bool' },
            { name: 'oldBalance', type: 'uint256' },
            { name: 'newBalance', type: 'uint256' },
            { name: 'deployedCode', type: 'bytes' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
            { name: 'reverted', type: 'bool' },
            {
              name: 'storageAccesses',
              type: 'tuple[]',
              components: [
                { name: 'account', type: 'address' },
                { name: 'slot', type: 'bytes32' },
                { name: 'isWrite', type: 'bool' },
                { name: 'previousValue', type: 'bytes32' },
                { name: 'newValue', type: 'bytes32' },
                { name: 'reverted', type: 'bool' },
              ],
            },
            { name: 'depth', type: 'uint64' },
            { name: 'oldNonce', type: 'uint64' },
            { name: 'newNonce', type: 'uint64' },
          ],
        },
      ],
      encoded as Hex
    );

    return accesses;
  }

  private decodePreimages(encoded: string): readonly ParentPreimage[] {
    const [arr] = decodeAbiParameters(
      [
        {
          type: 'tuple[]',
          components: [
            { name: 'slot', type: 'bytes32' },
            { name: 'parent', type: 'bytes32' },
            { name: 'key', type: 'bytes32' },
          ],
        },
      ],
      encoded as Hex
    );
    return arr;
  }

  private loadAndResolveConfig(): { contracts: Record<string, Record<string, ContractCfg>> } {
    const parsed = contractsCfg as unknown as {
      contracts: Record<string, Record<string, RawContractCfg>>;
      storageLayouts: Record<string, Record<string, SlotCfg>>;
    };

    const out: { contracts: Record<string, Record<string, ContractCfg>> } = { contracts: {} };

    // Normalize storage layouts: ensure lowercase slot keys
    const normalizedLayouts: Record<string, Record<string, SlotCfg>> = {};
    for (const [layoutName, slots] of Object.entries(parsed.storageLayouts || {})) {
      const layoutSlots: Record<string, SlotCfg> = {};
      for (const [slotKey, slotVal] of Object.entries(slots || {})) {
        layoutSlots[slotKey.toLowerCase()] = slotVal;
      }
      normalizedLayouts[layoutName] = layoutSlots;
    }

    for (const [chainId, contracts] of Object.entries(parsed.contracts || {})) {
      const lowerChain = chainId.trim();
      out.contracts[lowerChain] = {};
      for (const [addr, def] of Object.entries(contracts || {})) {
        const lowerAddr = addr.toLowerCase();
        const rawSlots = def.slots;
        let slots: Record<string, SlotCfg> = {};

        if (typeof rawSlots === 'string') {
          // Expect pattern: "{{storageLayouts.NAME}}"
          const m = rawSlots.match(/^\{\{storageLayouts\.(.+)\}\}$/);
          if (!m) {
            throw new Error(`Invalid slots reference for ${addr} on chain ${chainId}: ${rawSlots}`);
          }
          const layout = normalizedLayouts[m[1]];
          if (!layout) {
            throw new Error(`Missing storageLayouts.${m[1]} for ${addr} on ${chainId}`);
          }
          slots = layout;
        } else if (rawSlots && typeof rawSlots === 'object') {
          // Inline slots, normalize keys and field names
          const inline: Record<string, SlotCfg> = {};
          for (const [k, v] of Object.entries(rawSlots as Record<string, SlotCfg>)) {
            inline[k.toLowerCase()] = v;
          }
          slots = inline;
        } else {
          slots = {};
        }

        const normalizedSlots: Record<string, SlotCfg> = {};
        for (const [k, v] of Object.entries(slots)) normalizedSlots[k.toLowerCase()] = v;
        out.contracts[lowerChain][lowerAddr] = { name: def.name, slots: normalizedSlots };
      }
    }

    return out;
  }

  private buildDiffsMap(
    decoded: readonly VmSafeAccountAccess[]
  ): Map<
    string,
    { address: string; storageDiffs: Map<string, { key: Hex; before: Hex; after: Hex }> }
  > {
    const diffs = new Map<
      string,
      { address: string; storageDiffs: Map<string, { key: Hex; before: Hex; after: Hex }> }
    >();
    for (const d of decoded) {
      for (const a of d.storageAccesses) {
        if (!a.isWrite) continue;
        const addr = a.account.toLowerCase();
        let acct = diffs.get(addr);
        if (!acct) {
          acct = { address: addr, storageDiffs: new Map() };
          diffs.set(addr, acct);
        }
        const slot = this.n(a.slot);
        const existing = acct.storageDiffs.get(slot) || {
          key: slot,
          before: this.n(a.previousValue),
          after: this.n(a.previousValue),
        };
        existing.after = this.n(a.newValue);
        if (equalHex(existing.before, existing.after)) {
          acct.storageDiffs.delete(slot);
        } else {
          acct.storageDiffs.set(slot, existing);
        }
        if (acct.storageDiffs.size === 0) diffs.delete(addr);
      }
    }
    return diffs;
  }

  private convertOverridesToJSON(
    cfg: { contracts: Record<string, Record<string, ContractCfg>> },
    chainId: string,
    overrides: readonly StateOverrideDecoded[],
    parentMap: Map<Hex, Hex>
  ): StateOverride[] {
    const result: StateOverride[] = [];
    const chainContracts = cfg.contracts[chainId] || {};
    // Sort overrides by address
    const sortedOverrides = [...overrides].sort((a, b) =>
      a.contractAddress.toLowerCase().localeCompare(b.contractAddress.toLowerCase())
    );
    for (const o of sortedOverrides) {
      const addrLower = o.contractAddress.toLowerCase();
      const contract = chainContracts[addrLower];
      const name = contract?.name ?? '<<ContractName>>';
      const sortedStorage = [...o.overrides].sort((a, b) =>
        this.n(a.key).localeCompare(this.n(b.key))
      );
      const jsonOverrides = sortedStorage.map(s => {
        const slotCfg = this.getSlot(contract, this.n(s.key), parentMap);
        return {
          key: this.n(s.key),
          value: this.n(s.value),
          description: slotCfg.overrideMeaning,
        };
      });
      result.push({ name, address: addrLower, overrides: jsonOverrides });
    }
    return result;
  }

  private convertDiffsToJSON(
    cfg: { contracts: Record<string, Record<string, ContractCfg>> },
    chainId: string,
    diffs: Array<{
      address: string;
      storageDiffs: Map<string, { key: Hex; before: Hex; after: Hex }>;
    }>,
    parentMap: Map<Hex, Hex>
  ): StateChange[] {
    const result: StateChange[] = [];
    const chainContracts = cfg.contracts[chainId] || {};
    const sortedDiffs = [...diffs].sort((a, b) => a.address.localeCompare(b.address));
    for (const d of sortedDiffs) {
      const contract = chainContracts[d.address];
      const name = contract?.name ?? '<<ContractName>>';
      const storageArray = Array.from(d.storageDiffs.values());
      storageArray.sort((a, b) => a.key.localeCompare(b.key));
      const changes = storageArray
        .filter(s => !equalHex(s.before, s.after))
        .map(s => {
          const slotCfg = this.getSlot(contract, s.key, parentMap);
          return {
            key: s.key,
            before: this.n(s.before),
            after: this.n(s.after),
            description: slotCfg.summary,
            allowDifference: slotCfg.allowDifference,
          };
        });
      if (changes.length > 0) result.push({ name, address: d.address, changes });
    }
    return result;
  }

  private extractBalanceChanges(
    cfg: { contracts: Record<string, Record<string, ContractCfg>> },
    chainId: string,
    decoded: readonly VmSafeAccountAccess[]
  ): BalanceChange[] {
    const chainContracts = cfg.contracts[chainId] || {};
    type BalanceAccumulator = {
      delta: bigint;
      lastNew: bigint;
    };

    const accMap = new Map<string, BalanceAccumulator>();

    for (const access of decoded) {
      const delta = access.newBalance - access.oldBalance;
      if (delta === BigInt(0) || access.kind === 1) continue;
      const addr = access.account.toLowerCase();
      const existing = accMap.get(addr);
      if (!existing) {
        accMap.set(addr, { delta, lastNew: access.newBalance });
      } else {
        existing.delta += delta;
        existing.lastNew = access.newBalance;
      }
    }

    const result: BalanceChange[] = [];

    for (const [addr, value] of accMap) {
      if (value.delta === BigInt(0)) continue;
      const contract = chainContracts[addr];
      const name = contract?.name ?? '<<ContractName>>';
      const after = value.lastNew;
      const before = after - value.delta;
      if (before < BigInt(0)) {
        throw new Error(`Negative balance calculated for ${addr}`);
      }
      const beforeHex = normalize32(bigintToHex(before));
      const afterHex = normalize32(bigintToHex(after));
      result.push({
        name,
        address: addr,
        field: 'ETH Balance (wei)',
        before: beforeHex,
        after: afterHex,
        description: 'ETH balance change for this account',
        allowDifference: false,
      });
    }

    result.sort((a, b) => a.address.localeCompare(b.address));
    return result;
  }

  private getSlot(contract: ContractCfg | undefined, slot: Hex, parentMap: Map<Hex, Hex>): SlotCfg {
    const DEFAULT: SlotCfg = {
      type: '<<DecodedKind>>',
      summary: '<<Summary>>',
      overrideMeaning: '<<OverrideMeaning>>',
      allowDifference: false,
    };
    let current = slot;
    while (true) {
      const found = contract?.slots?.[current];
      if (found) return found;
      const parent = parentMap.get(current);
      if (!parent) return DEFAULT;
      current = parent;
    }
  }

  private n(hex: string): Hex {
    const h = (hex || '').toLowerCase();
    if (!h.startsWith('0x')) return ('0x' + h) as Hex;
    return ('0x' + h.slice(2)) as Hex;
  }
}

function slotHex(h: string): Hex {
  // Normalize to 0x + 64 hex chars
  const v = (h || '').toLowerCase();
  if (!v.startsWith('0x')) return ('0x' + v.padStart(64, '0')) as Hex;
  const body = v.slice(2);
  if (body.length === 64) return ('0x' + body) as Hex;
  return ('0x' + body.padStart(64, '0')) as Hex;
}

function equalHex(a: string, b: string): boolean {
  const na = normalize32(a);
  const nb = normalize32(b);
  return na === nb;
}

function normalize32(h: string): Hex {
  const v = (h || '').toLowerCase();
  const body = v.startsWith('0x') ? v.slice(2) : v;
  return ('0x' + body.padStart(64, '0')) as Hex;
}

function bigintToHex(value: bigint): Hex {
  if (value < BigInt(0)) throw new Error('Negative bigint cannot be converted to hex');
  return ('0x' + value.toString(16)) as Hex;
}
