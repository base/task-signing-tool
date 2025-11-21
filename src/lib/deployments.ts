import fs from 'fs';
import path from 'path';
import { NetworkType, TaskStatus } from './types';
import { availableNetworks } from './constants';

let cachedRoot: string | null = null;

export function findContractDeploymentsRoot(): string {
  if (cachedRoot) return cachedRoot;

  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const hasNetworkFolders = availableNetworks.some(network => {
      const netPath = path.join(currentDir, network);
      return fs.existsSync(netPath) && fs.statSync(netPath).isDirectory();
    });

    if (hasNetworkFolders) {
      cachedRoot = currentDir;
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  // Fallback for default behavior
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

function normalizeUrl(rawUrl: string): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('http')) return undefined;
  return trimmed.replace(/[)\].,]+$/, '');
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
  return match ? match[1] : folderName.substring(0, 10);
}

export function getUpgradeOptions(network: NetworkType): DeploymentInfo[] {
  const contractDeploymentsPath = findContractDeploymentsRoot();
  const networkPath = path.join(contractDeploymentsPath, network);

  if (!fs.existsSync(networkPath)) {
    console.error(`Network path does not exist: ${networkPath}`);
    return [];
  }

  try {
    const folders = fs
      .readdirSync(networkPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => /^\d{4}-\d{2}-\d{2}-/.test(name));

    const upgrades = folders.map(folderName => {
      const date = deriveDateFromFolder(folderName);
      const baseInfo: DeploymentInfo = {
        id: folderName,
        name: formatUpgradeName(folderName),
        description: '',
        date,
        network,
      };

      const readmePath = path.join(networkPath, folderName, 'README.md');
      if (!fs.existsSync(readmePath)) {
        return baseInfo;
      }

      try {
        const content = fs.readFileSync(readmePath, 'utf-8');
        const { status, executionLinks } = parseExecutionStatus(content);
        return {
          ...baseInfo,
          description: extractDescription(content),
          status,
          executionLinks,
        };
      } catch (parseError) {
        console.error(`Error parsing ${folderName}:`, parseError);
        return { ...baseInfo, description: DEFAULT_DESCRIPTION };
      }
    });

    return upgrades.sort((a, b) => b.id.localeCompare(a.id));
  } catch (error) {
    console.error(`Error reading deployment folders for ${network}:`, error);
    return [];
  }
}
