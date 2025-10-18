import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createPublicClient, http, decodeAbiParameters, Hex, Address } from 'viem';
import YAML from 'yaml';
import { StateChange, StateDiffResult, StateOverride } from './types/index';
import { CONTRACTS_YAML } from './state-diff-config';

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

type SlotCfg = { type: string; summary: string; 'override-meaning': string };
type ContractCfg = { name: string; slots: Record<string, SlotCfg> };
type ConfigRoot = {
  contracts: Record<string, Record<string, { name: string; slots: any }>>;
  'storage-layouts': Record<string, Record<string, SlotCfg>>;
};

export class StateDiffClient {
  async simulate(
    rpcUrl: string,
    forgeCmdParts: string[],
    workdir: string
  ): Promise<{
    result: StateDiffResult;
    output: string;
  }> {
    const [cmd, cmdArgs] = this.normalizeForgeCmd(forgeCmdParts);
    console.log(`🔧 Running forge in ${workdir}: ${cmd} ${cmdArgs.join(' ')}`);

    const { stdout, stderr, code } = await this.runCommand(cmd, cmdArgs, workdir, 120000);
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

    const result: StateDiffResult = {
      task_name: '',
      script_name: '',
      signature: '',
      args: '',
      expected_domain_and_message_hashes: {
        address: parsed.targetSafe,
        domain_hash: domainHash,
        message_hash: messageHash,
      },
      state_overrides: this.convertOverridesToJSON(
        config,
        chainIdStr,
        payload.stateOverrides,
        parentMap
      ),
      state_changes: this.convertDiffsToJSON(config, chainIdStr, diffsList, parentMap),
    };

    const output = `<<<RESULT>>>\n${JSON.stringify(result, null, 2)}`;
    console.log('✅ State-diff transformation completed');
    return { result, output };
  }

  // Convert JSON to app types
  parseStateChanges(result: StateDiffResult): StateChange[] {
    return result.state_changes.map(change => ({
      name: change.name,
      address: change.address,
      changes: change.changes.map(c => ({
        key: c.key,
        before: c.before,
        after: c.after,
        description: c.description,
      })),
    }));
  }

  parseStateOverrides(result: StateDiffResult): StateOverride[] {
    return result.state_overrides.map(override => ({
      name: override.name,
      address: override.address,
      overrides: override.overrides.map(o => ({
        key: o.key,
        value: o.value,
        description: o.description,
      })),
    }));
  }

  private normalizeForgeCmd(forgeCmdParts: string[]): [string, string[]] {
    if (forgeCmdParts.length === 0) throw new Error('forgeCmdParts must not be empty');
    if (forgeCmdParts[0] === 'forge') return ['forge', forgeCmdParts.slice(1)];
    return [forgeCmdParts[0], forgeCmdParts.slice(1)];
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

  private decodePreimages(encoded: string): ParentPreimage[] {
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
    ) as unknown as any[];
    return (arr as any[]).map(p => ({ slot: p[0] as Hex, parent: p[1] as Hex, key: p[2] as Hex }));
  }

  private loadAndResolveConfig(): { contracts: Record<string, Record<string, ContractCfg>> } {
    const parsed = YAML.parse(CONTRACTS_YAML) as ConfigRoot;
    const out: { contracts: Record<string, Record<string, ContractCfg>> } = { contracts: {} };
    const layouts = parsed['storage-layouts'] || {};
    for (const [chainId, contracts] of Object.entries(parsed.contracts || {})) {
      const lowerChain = chainId.trim();
      out.contracts[lowerChain] = {};
      for (const [addr, def] of Object.entries(contracts || {})) {
        const lowerAddr = addr.toLowerCase();
        let slots: Record<string, SlotCfg> = {};
        const rawSlots = def.slots;
        if (typeof rawSlots === 'string') {
          const m = rawSlots.match(/^\$\{\{storage-layouts\.(.+)\}\}$/);
          if (!m)
            throw new Error(`Invalid slots reference for ${addr} on chain ${chainId}: ${rawSlots}`);
          const layout = layouts[m[1]];
          if (!layout) throw new Error(`Missing storage-layouts.${m[1]} for ${addr} on ${chainId}`);
          slots = layout;
        } else if (rawSlots && typeof rawSlots === 'object') {
          slots = rawSlots as Record<string, SlotCfg>;
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
          description: slotCfg['override-meaning'],
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
          };
        });
      if (changes.length > 0) result.push({ name, address: d.address, changes });
    }
    return result;
  }

  private getSlot(contract: ContractCfg | undefined, slot: Hex, parentMap: Map<Hex, Hex>): SlotCfg {
    const DEFAULT: SlotCfg = {
      type: '<<DecodedKind>>',
      summary: '<<Summary>>',
      'override-meaning': '<<OverrideMeaning>>',
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
