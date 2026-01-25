import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { createPublicClient, http, decodeAbiParameters, Hex, Address, getAddress } from 'viem';
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

type SlotCfg = {
  type: string;
  summary: string;
  overrideMeaning: string;
  allowDifference: boolean;
  allowOverrideDifference: boolean;
};
type ContractCfg = { name: string; slots: Record<string, SlotCfg> };
type RawContractCfg = { name: string; slots?: string | Record<string, SlotCfg> };

export class StateDiffClient {
  private readonly ledgerId: number;

  constructor(ledgerId: number = 0) {
    this.ledgerId = ledgerId;
  }

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

    const { command, args, env: envAssignments } = this.extractCommandDetails(forgeCmdParts);
    const spawnEnv = { ...process.env, ...envAssignments };

    const { stdout, stderr, code } = await this.runCommand(
      command,
      args,
      workdir,
      120000,
      spawnEnv
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

    const stateDiffPath = this.stateDiffFilePath(workdir);
    const parsed = await this.readEncodedStateDiff(stateDiffPath);

    try {
      const { domainHash, messageHash } = this.getDomainAndMessageHashes(parsed.dataToSign);
      const payload = this.decodeOverrides(parsed.overrides);
      const decodedDiff = this.decodeStateDiff(parsed.stateDiff);
      const decodedPreimages = this.decodePreimages(parsed.preimages);
      const parentMap = this.buildParentMap(decodedPreimages);
      const config = this.loadAndResolveConfig();
      const diffsMap = this.buildDiffsMap(decodedDiff);
      const balanceChanges = this.extractBalanceChanges(config, chainIdStr, decodedDiff);

      const result = this.buildTaskConfig({
        cmd,
        rpcUrl,
        parsed,
        domainHash,
        messageHash,
        config,
        chainIdStr,
        payload,
        diffs: Array.from(diffsMap.values()),
        balanceChanges,
        parentMap,
      });

      const output = `<<<RESULT>>>\n${JSON.stringify(result, null, 2)}`;
      console.log('✅ State-diff transformation completed');
      return { result, output };
    } finally {
      await this.deleteFile(stateDiffPath);
    }
  }

  private runCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number,
    env: NodeJS.ProcessEnv
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise(resolve => {
      const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
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

  private extractCommandDetails(commandParts: string[]): {
    command: string;
    args: string[];
    env: Record<string, string>;
  } {
    if (commandParts.length === 0) {
      throw new Error('StateDiffClient::extractCommandDetails: No command provided to execute.');
    }

    const envAssignments: Record<string, string> = {};
    let index = 0;

    const assignmentRegex = /^[A-Za-z_][A-Za-z0-9_]*=/;

    while (index < commandParts.length && assignmentRegex.test(commandParts[index])) {
      const token = commandParts[index];
      const eqIdx = token.indexOf('=');
      const key = token.slice(0, eqIdx);
      const value = token.slice(eqIdx + 1);
      envAssignments[key] = value;
      index += 1;
    }

    if (index >= commandParts.length) {
      throw new Error(
        'StateDiffClient::extractCommandDetails: Command missing after environment assignments.'
      );
    }

    const command = commandParts[index];
    const args = commandParts.slice(index + 1);

    return { command, args, env: envAssignments };
  }

  private stateDiffFilePath(workdir: string): string {
    // Resolve and normalize the workdir to get the canonical path
    const normalizedWorkdir = path.resolve(workdir);
    const filePath = path.resolve(normalizedWorkdir, 'stateDiff.json');

    // Ensure the resolved file path is contained within the workdir
    // This prevents path traversal attacks via malicious workdir values
    if (!filePath.startsWith(normalizedWorkdir + path.sep) && filePath !== normalizedWorkdir) {
      throw new Error(
        `StateDiffClient::stateDiffFilePath: Path traversal detected. File path must be within workdir.`
      );
    }

    return filePath;
  }

  private async readEncodedStateDiff(filePath: string): Promise<ParsedInput> {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as ParsedInput;
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        throw new Error(`stateDiff.json not found at ${filePath}`);
      }
      throw err;
    }
  }

  private async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return;
      }
      throw new Error(`Failed to delete stateDiff.json at ${filePath}: ${String(err)}`);
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

  private static configCache: { contracts: Record<string, Record<string, ContractCfg>> } | null =
    null;

  private loadAndResolveConfig(): { contracts: Record<string, Record<string, ContractCfg>> } {
    if (StateDiffClient.configCache) return StateDiffClient.configCache;

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

    StateDiffClient.configCache = out;
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
          allowDifference: slotCfg.allowOverrideDifference,
        };
      });
      result.push({ name, address: getAddress(addrLower), overrides: jsonOverrides });
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
      const changes = storageArray.map(s => {
        const slotCfg = this.getSlot(contract, s.key, parentMap);
        return {
          key: s.key,
          before: this.n(s.before),
          after: this.n(s.after),
          description: slotCfg.summary,
          allowDifference: slotCfg.allowDifference,
        };
      });
      if (changes.length > 0) result.push({ name, address: getAddress(d.address), changes });
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
        address: getAddress(addr),
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
      allowOverrideDifference: false,
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

  private buildParentMap(decodedPreimages: readonly ParentPreimage[]): Map<Hex, Hex> {
    const parentMap = new Map<Hex, Hex>();
    for (const p of decodedPreimages) {
      parentMap.set(normalize32(p.slot), normalize32(p.parent));
    }
    return parentMap;
  }

  private buildTaskConfig(params: {
    cmd: string;
    rpcUrl: string;
    parsed: ParsedInput;
    domainHash: Hex;
    messageHash: Hex;
    config: { contracts: Record<string, Record<string, ContractCfg>> };
    chainIdStr: string;
    payload: PayloadDecoded;
    diffs: Array<{
      address: string;
      storageDiffs: Map<string, { key: Hex; before: Hex; after: Hex }>;
    }>;
    balanceChanges: BalanceChange[];
    parentMap: Map<Hex, Hex>;
  }): TaskConfig {
    const {
      cmd,
      rpcUrl,
      parsed,
      domainHash,
      messageHash,
      config,
      chainIdStr,
      payload,
      diffs,
      balanceChanges,
      parentMap,
    } = params;

    return {
      cmd,
      ledgerId: this.ledgerId,
      rpcUrl,
      expectedDomainAndMessageHashes: {
        address: getAddress(parsed.targetSafe),
        domainHash,
        messageHash,
      },
      stateOverrides: this.convertOverridesToJSON(
        config,
        chainIdStr,
        payload.stateOverrides,
        parentMap
      ),
      stateChanges: this.convertDiffsToJSON(config, chainIdStr, diffs, parentMap),
      balanceChanges,
    };
  }
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
