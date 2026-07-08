import fs from 'fs';
import path from 'path';
import { NetworkType, TaskStatus } from './types';

let cachedRoot: string | null = null;

function isDirectory(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

export function resetContractDeploymentsRootCacheForTests(): void {
  cachedRoot = null;
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

export interface DeploymentInfo {
  id: string;
  name: string;
  description: string;
  date: string;
  network: NetworkType;
  status?: TaskStatus;
  executionLinks?: Array<{
    url: string;
    label: string;
  }>;
}

const DEFAULT_DESCRIPTION = 'Smart contract upgrade deployment';
const MAX_STATUS_SEARCH_LINES = 20;
const MAX_STATUS_FOLLOW_UP_LINES = 5;

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
  try {
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
  } catch (error) {
    console.warn('extractDescription fallback:', error);
    return DEFAULT_DESCRIPTION;
  }
}

export function normalizeUrl(rawUrl: string): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim().replace(/[)\].,]+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return undefined;
  }
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return undefined;
  }
}

function parseExecutionStatus(content: string): {
  status?: TaskStatus;
  executionLinks?: Array<{ url: string; label: string }>;
} {
  try {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const statusLineIndex = lines
      .slice(0, MAX_STATUS_SEARCH_LINES)
      .findIndex(line => /status:/i.test(line));
    if (statusLineIndex === -1) {
      return {};
    }

    const statusLine = lines[statusLineIndex];
    const normalizedStatus = statusLine.toUpperCase();
    const isExecuted = normalizedStatus.includes(TaskStatus.Executed);
    const isReady = normalizedStatus.includes(TaskStatus.ReadyToSign);

    if (!isExecuted) {
      if (isReady) {
        return { status: TaskStatus.ReadyToSign };
      }
      return { status: TaskStatus.Pending };
    }

    const executionLinks: Array<{ url: string; label: string }> = [];
    const seenUrls = new Set<string>();

    const addLink = (label: string, maybeUrl: string | undefined) => {
      const url = maybeUrl ? normalizeUrl(maybeUrl) : undefined;
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);
      executionLinks.push({ label: label || 'Transaction', url });
    };

    for (const match of statusLine.matchAll(/https?:\/\/[^\s)\]]+/g)) {
      addLink('Transaction', match[0]);
    }

    for (
      let i = statusLineIndex + 1;
      i < lines.length && i <= statusLineIndex + MAX_STATUS_FOLLOW_UP_LINES;
      i++
    ) {
      const rawLine = lines[i].trim();
      if (!rawLine) break;
      if (rawLine.startsWith('#')) break;

      const labelledMatch = rawLine.match(/^([^:]+):\s*(https?:\/\/\S+)/i);
      if (labelledMatch) {
        addLink(labelledMatch[1].trim(), labelledMatch[2]);
        continue;
      }

      const urlMatch = rawLine.match(/https?:\/\/\S+/);
      if (urlMatch) {
        addLink('Transaction', urlMatch[0]);
      }
    }

    return executionLinks.length > 0
      ? { status: TaskStatus.Executed, executionLinks }
      : { status: TaskStatus.Executed };
  } catch (error) {
    console.error('parseExecutionStatus error:', error);
    return {};
  }
}

function deriveDateFromFolder(folderName: string): string {
  const match = folderName.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : folderName;
}

function getUpgradeOption(
  contractDeploymentsPath: string,
  taskId: string,
  network: NetworkType
): DeploymentInfo | undefined {
  const evmPath = path.join(contractDeploymentsPath, 'active', 'evm');
  const taskPath = path.join(evmPath, 'tasks', taskId);
  const networkConfigPath = path.join(taskPath, 'config', network);
  const validationsPath = path.join(networkConfigPath, 'validations');

  if (!fs.existsSync(validationsPath) || !fs.statSync(validationsPath).isDirectory()) {
    return undefined;
  }

  const baseInfo: DeploymentInfo = {
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
    const { status, executionLinks } = parseExecutionStatus(content);
    return {
      ...baseInfo,
      name: extractTitle(content) || baseInfo.name,
      description: extractDescription(content),
      status,
      executionLinks,
    };
  } catch (parseError) {
    console.error(`Error parsing ${readmePath}:`, parseError);
    return { ...baseInfo, description: DEFAULT_DESCRIPTION };
  }
}

export function getUpgradeOptions(network: NetworkType): DeploymentInfo[] {
  const contractDeploymentsPath = findContractDeploymentsRoot();
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
      .filter((option): option is DeploymentInfo => option !== undefined)
      .sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    console.error(`Error reading active task folders for ${network}:`, error);
    return [];
  }
}
