import { promises as fs } from 'fs';
import path from 'path';
import { parseArgs } from 'node:util';
import { availableNetworks, TASK_ORIGIN_SIGNATURE_FILE_NAMES } from '@/lib/constants';
import { parseFromString } from '@/lib/parser';
import type { NetworkType } from '@/lib/types';

type TargetKind = 'root' | 'network' | 'task';
type Severity = 'error' | 'warning';

type ValidationMessage = {
  severity: Severity;
  path: string;
  message: string;
};

type Target = {
  kind: TargetKind;
  rootPath: string;
  network?: NetworkType;
  taskName?: string;
  targetPath: string;
};

const TASK_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}-.+/;

function printUsage(): void {
  const networks = availableNetworks.join(', ');
  const msg = `
Validate the task repository structure used by task-signing-tool.

Usage:
  tsx scripts/validate-structure.ts [folder]
  tsx scripts/validate-structure.ts --folder <path>
  tsx scripts/validate-structure.ts --task-folder <path>
  tsx scripts/validate-structure.ts --root <path>

When no folder is provided, the script searches upward from the current
directory for a task repository root containing a supported network folder.

Supported networks:
  ${networks}

Examples:
  npm run validate-structure
  npm run validate-folder -- ../mainnet/2026-05-27-update-aggregate-verifier
  npm run validate-structure -- --root ..
`;
  console.log(msg);
}

function relativeToCwd(targetPath: string): string {
  const relative = path.relative(process.cwd(), targetPath);
  return relative || '.';
}

function addMessage(
  messages: ValidationMessage[],
  severity: Severity,
  targetPath: string,
  message: string
): void {
  messages.push({
    severity,
    path: relativeToCwd(targetPath),
    message,
  });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    return (await fs.stat(targetPath)).isDirectory();
  } catch {
    return false;
  }
}

async function isFile(targetPath: string): Promise<boolean> {
  try {
    return (await fs.stat(targetPath)).isFile();
  } catch {
    return false;
  }
}

async function hasSupportedNetworkDir(targetPath: string): Promise<boolean> {
  for (const network of availableNetworks) {
    if (await isDirectory(path.join(targetPath, network))) {
      return true;
    }
  }
  return false;
}

async function findDefaultRoot(): Promise<string> {
  let currentDir = process.cwd();
  const fsRoot = path.parse(currentDir).root;

  while (currentDir !== fsRoot) {
    if (await hasSupportedNetworkDir(currentDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  if (path.basename(process.cwd()) === 'task-signing-tool') {
    return path.dirname(process.cwd());
  }

  return process.cwd();
}

async function resolveTarget(targetArg: string | undefined): Promise<Target> {
  const targetPath = targetArg ? path.resolve(process.cwd(), targetArg) : await findDefaultRoot();

  if (!(await isDirectory(targetPath))) {
    throw new Error(`Target is not a directory: ${targetPath}`);
  }

  const baseName = path.basename(targetPath);
  const parentPath = path.dirname(targetPath);
  const parentName = path.basename(parentPath) as NetworkType;

  if (availableNetworks.includes(parentName) && TASK_FOLDER_PATTERN.test(baseName)) {
    return {
      kind: 'task',
      rootPath: path.dirname(parentPath),
      network: parentName,
      taskName: baseName,
      targetPath,
    };
  }

  if (availableNetworks.includes(baseName as NetworkType)) {
    return {
      kind: 'network',
      rootPath: parentPath,
      network: baseName as NetworkType,
      targetPath,
    };
  }

  if (await hasSupportedNetworkDir(targetPath)) {
    return {
      kind: 'root',
      rootPath: targetPath,
      targetPath,
    };
  }

  throw new Error(
    `Could not determine what to validate for ${targetPath}. Provide a task repo root, supported network folder, or YYYY-MM-DD-* task folder.`
  );
}

async function validateRoot(rootPath: string, messages: ValidationMessage[]): Promise<void> {
  const presentNetworks: NetworkType[] = [];

  for (const network of availableNetworks) {
    const networkPath = path.join(rootPath, network);
    if (await isDirectory(networkPath)) {
      presentNetworks.push(network);
      await validateNetwork(rootPath, network, messages, false);
    }
  }

  if (presentNetworks.length === 0) {
    addMessage(
      messages,
      'error',
      rootPath,
      `No supported network directories found. Expected one of: ${availableNetworks.join(', ')}.`
    );
  }
}

async function validateNetwork(
  rootPath: string,
  network: NetworkType,
  messages: ValidationMessage[],
  strictTask: boolean
): Promise<void> {
  const networkPath = path.join(rootPath, network);
  const entries = await fs.readdir(networkPath, { withFileTypes: true });
  let taskCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(networkPath, entry.name);
    if (entry.name === 'signatures') {
      continue;
    }

    if (!TASK_FOLDER_PATTERN.test(entry.name)) {
      addMessage(
        messages,
        'error',
        entryPath,
        'Unexpected directory in network folder. Task directories must start with YYYY-MM-DD-, or be named signatures.'
      );
      continue;
    }

    taskCount += 1;
    await validateTask(rootPath, network, entry.name, messages, strictTask);
  }

  if (taskCount === 0) {
    addMessage(messages, 'warning', networkPath, 'No YYYY-MM-DD-* task directories found.');
  }
}

async function validateTask(
  rootPath: string,
  network: NetworkType,
  taskName: string,
  messages: ValidationMessage[],
  strict: boolean
): Promise<void> {
  const taskPath = path.join(rootPath, network, taskName);
  const validationsPath = path.join(taskPath, 'validations');

  if (!(await pathExists(validationsPath))) {
    addMessage(
      messages,
      strict ? 'error' : 'warning',
      taskPath,
      'Missing validations/ directory. The app can list this task, but no user validation configs are available.'
    );
    return;
  }

  if (!(await isDirectory(validationsPath))) {
    addMessage(messages, 'error', validationsPath, 'validations exists but is not a directory.');
    return;
  }

  const entries = await fs.readdir(validationsPath, { withFileTypes: true });
  const jsonFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith('.json'));

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.endsWith('.json')) {
      continue;
    }
    addMessage(
      messages,
      'warning',
      path.join(validationsPath, entry.name),
      'Ignoring non-JSON file in validations directory.'
    );
  }

  if (jsonFiles.length === 0) {
    addMessage(
      messages,
      'error',
      validationsPath,
      'validations/ must contain at least one JSON config file.'
    );
    return;
  }

  for (const file of jsonFiles) {
    await validateConfigFile(
      rootPath,
      network,
      taskName,
      path.join(validationsPath, file.name),
      messages
    );
  }
}

async function validateConfigFile(
  rootPath: string,
  network: NetworkType,
  taskName: string,
  configPath: string,
  messages: ValidationMessage[]
): Promise<void> {
  const configContent = await fs.readFile(configPath, 'utf-8');
  const parsedConfig = parseFromString(configContent);

  if (!parsedConfig.result.success) {
    for (const issue of parsedConfig.result.zodError.issues) {
      const issuePath = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      addMessage(messages, 'error', configPath, `${issuePath}${issue.message}`);
    }
    return;
  }

  if (!('config' in parsedConfig)) {
    addMessage(messages, 'error', configPath, 'Parsed config did not include config data.');
    return;
  }

  const config = parsedConfig.config;
  if (config.skipTaskOriginValidation === true) {
    return;
  }

  if (!config.taskOriginConfig) {
    addMessage(
      messages,
      'error',
      configPath,
      'taskOriginConfig is required unless skipTaskOriginValidation is true.'
    );
    return;
  }

  const signatureDir = path.join(rootPath, network, 'signatures', taskName);
  for (const signatureFileName of Object.values(TASK_ORIGIN_SIGNATURE_FILE_NAMES)) {
    const signaturePath = path.join(signatureDir, signatureFileName);
    if (!(await isFile(signaturePath))) {
      addMessage(
        messages,
        'error',
        signaturePath,
        `Missing required task origin signature for ${relativeToCwd(configPath)}.`
      );
    }
  }
}

function printResults(target: Target, messages: ValidationMessage[]): void {
  const errors = messages.filter(message => message.severity === 'error');
  const warnings = messages.filter(message => message.severity === 'warning');

  console.log(`Validated ${target.kind}: ${relativeToCwd(target.targetPath)}`);

  for (const warning of warnings) {
    console.warn(`WARNING ${warning.path}: ${warning.message}`);
  }

  for (const error of errors) {
    console.error(`ERROR ${error.path}: ${error.message}`);
  }

  if (errors.length > 0) {
    console.error(
      `\nValidation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`Validation passed with ${warnings.length} warning(s).`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      folder: { type: 'string' },
      'task-folder': { type: 'string' },
      root: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    return;
  }

  if (positionals.length > 1) {
    console.error('Error: Provide at most one folder argument.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const explicitTargets = [
    values.folder,
    values['task-folder'],
    values.root,
    positionals[0],
  ].filter(Boolean);
  if (explicitTargets.length > 1) {
    console.error(
      'Error: Provide only one of --folder, --task-folder, --root, or a positional folder.'
    );
    printUsage();
    process.exitCode = 1;
    return;
  }

  const targetArg = explicitTargets[0];
  const target = await resolveTarget(targetArg);
  const messages: ValidationMessage[] = [];

  if (target.kind === 'root') {
    await validateRoot(target.rootPath, messages);
  } else if (target.kind === 'network' && target.network) {
    await validateNetwork(target.rootPath, target.network, messages, false);
  } else if (target.kind === 'task' && target.network && target.taskName) {
    await validateTask(target.rootPath, target.network, target.taskName, messages, true);
  }

  printResults(target, messages);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
