import fs from 'fs';
import path from 'path';
import { NetworkType, TaskStatus, Upgrade } from './types';

let cachedRoot: string | null = null;
let cachedCatalog: ReturnType<typeof createTaskCatalog> | null = null;

function isDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function resetContractDeploymentsRootCacheForTests(): void {
  cachedRoot = null;
  cachedCatalog = null;
}

function hasTaskLayout(root: string): boolean {
  return isDirectory(path.join(root, 'active', 'evm', 'tasks'));
}

export function findContractDeploymentsRoot(): string {
  if (cachedRoot) return cachedRoot;

  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    if (hasTaskLayout(currentDir)) {
      cachedRoot = currentDir;
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  // Fallback for default behavior when the tool is cloned inside the task repo root.
  cachedRoot = path.join(process.cwd(), '..');
  return cachedRoot;
}

const DEFAULT_DESCRIPTION = 'Smart contract upgrade deployment';
const MAX_STATUS_SEARCH_LINES = 20;

export type TaskCatalogErrorKind = 'invalid-id' | 'outside-root' | 'not-found' | 'invalid-profile';

export class TaskCatalogError extends Error {
  constructor(
    public readonly kind: TaskCatalogErrorKind,
    message: string
  ) {
    super(message);
    this.name = 'TaskCatalogError';
  }
}

function taskDirs(root: string, taskId: string, network: string) {
  const evmDir = path.join(root, 'active', 'evm');
  const taskDir = path.join(evmDir, 'tasks', taskId);
  return {
    evmDir,
    taskDir,
    signaturesDir: path.join(taskDir, 'signatures', network),
    taskOriginDir: path.join(taskDir, 'config', network),
  };
}

function resolveExistingAncestor(dir: string): string {
  try {
    return fs.realpathSync(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (fs.lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) {
      return resolveExistingAncestor(path.resolve(path.dirname(dir), fs.readlinkSync(dir)));
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw error;
    return path.join(resolveExistingAncestor(parent), path.basename(dir));
  }
}

function assertInsideRoot(root: string, dir: string): void {
  const relative = path.relative(root, dir);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new TaskCatalogError('outside-root', `Task path is outside the catalog root: ${dir}`);
  }
}

export function createTaskCatalog(root: string) {
  root = path.resolve(root);
  return {
    root,
    listTasks: (network: NetworkType) => listTasks(root, network),
    taskDirs: (taskId: string, network: string) => {
      for (const id of [taskId, network]) {
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
          throw new TaskCatalogError('invalid-id', `Invalid Task id or network: ${id}`);
        }
      }
      const dirs = taskDirs(root, taskId, network);
      const realRoot = resolveExistingAncestor(root);
      for (const dir of Object.values(dirs)) {
        assertInsideRoot(root, path.resolve(dir));
        assertInsideRoot(realRoot, resolveExistingAncestor(dir));
      }
      return dirs;
    },
  };
}

export function defaultTaskCatalog() {
  cachedCatalog ??= createTaskCatalog(findContractDeploymentsRoot());
  return cachedCatalog;
}

function formatUpgradeName(folderName: string): string {
  const slug = folderName.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return slug
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function extractTitle(content: string): string | undefined {
  const titleLine = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .find(line => /^#\s+/.test(line.trim()));
  return titleLine?.replace(/^#\s+/, '').trim() || undefined;
}

function cleanMarkdownBlock(block: string): string {
  return block.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '');
}

function extractDescription(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n');
  const descriptionMatch = normalized.match(/##\s*Description[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i);
  if (descriptionMatch) {
    return cleanMarkdownBlock(descriptionMatch[1]);
  }

  const lines = normalized.split('\n');
  const paragraph: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (paragraph.length > 0) break;
      continue;
    }

    if (trimmed.startsWith('#')) continue;
    if (/^status\s*:/i.test(trimmed)) continue;

    paragraph.push(rawLine.replace(/[ \t]+$/g, ''));
  }

  const fallback = cleanMarkdownBlock(paragraph.join('\n'));
  return fallback || DEFAULT_DESCRIPTION;
}

function parseExecutionStatus(content: string): TaskStatus | undefined {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const statusLineIndex = lines
    .slice(0, MAX_STATUS_SEARCH_LINES)
    .findIndex(line => /status:/i.test(line));
  if (statusLineIndex === -1) {
    return undefined;
  }

  const statusLine = lines[statusLineIndex];
  const normalizedStatus = statusLine.toUpperCase();
  const isExecuted = normalizedStatus.includes(TaskStatus.Executed);
  const isReady = normalizedStatus.includes(TaskStatus.ReadyToSign);

  if (isExecuted) return TaskStatus.Executed;
  return isReady ? TaskStatus.ReadyToSign : TaskStatus.Pending;
}

function deriveDateFromFolder(folderName: string): string {
  const match = folderName.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : folderName;
}

function getUpgradeOption(
  contractDeploymentsPath: string,
  taskId: string,
  network: NetworkType
): Upgrade | undefined {
  const {
    evmDir: evmPath,
    taskDir: taskPath,
    taskOriginDir: networkConfigPath,
  } = taskDirs(contractDeploymentsPath, taskId, network);
  const validationsPath = path.join(networkConfigPath, 'validations');

  if (!fs.existsSync(validationsPath) || !fs.statSync(validationsPath).isDirectory()) {
    return undefined;
  }

  const baseInfo: Upgrade = {
    id: taskId,
    name: formatUpgradeName(taskId),
    description: '',
    date: deriveDateFromFolder(taskId),
    network,
  };

  const readmePath = [
    path.join(networkConfigPath, 'README.md'),
    path.join(taskPath, 'README.md'),
    path.join(evmPath, 'README.md'),
  ].find(filePath => fs.existsSync(filePath) && fs.statSync(filePath).isFile());

  if (!readmePath) {
    return baseInfo;
  }

  try {
    const content = fs.readFileSync(readmePath, 'utf-8');
    const status = parseExecutionStatus(content);
    return {
      ...baseInfo,
      name: extractTitle(content) || baseInfo.name,
      description: extractDescription(content),
      status,
    };
  } catch (parseError) {
    console.error(`Error parsing ${readmePath}:`, parseError);
    return { ...baseInfo, description: DEFAULT_DESCRIPTION };
  }
}

function listTasks(contractDeploymentsPath: string, network: NetworkType): Upgrade[] {
  const tasksPath = path.join(contractDeploymentsPath, 'active', 'evm', 'tasks');

  if (!isDirectory(tasksPath)) {
    return [];
  }

  try {
    return fs
      .readdirSync(tasksPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .filter(dirent => /^\d{4}-\d{2}-\d{2}-/.test(dirent.name))
      .map(dirent => getUpgradeOption(contractDeploymentsPath, dirent.name, network))
      .filter((option): option is Upgrade => option !== undefined)
      .sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    console.error(`Error reading active task folders for ${network}:`, error);
    return [];
  }
}
