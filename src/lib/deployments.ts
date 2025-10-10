import fs from 'fs';
import path from 'path';
import { NetworkType, TaskStatus } from './types';

export interface UpgradeOption {
  id: string;
  name: string;
  description: string;
  network: NetworkType;
  status?: TaskStatus;
  executionLink?: string;
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

function formatUpgradeName(folderName: string): string {
  // Convert folder name like "2025-06-04-upgrade-system-config" to "Upgrade System Config"
  const parts = folderName.split('-');
  const nameParts = parts.slice(3); // Skip date parts (2025-06-04)

  return nameParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function extractDescription(content: string): string {
  try {
    // Look for description after "## Description" header
    const descriptionMatch = content.match(/## Description\s*\n\n([^#]+?)(?=\n\n|\n##|\n###|$)/);
    if (descriptionMatch) {
      let description = descriptionMatch[1].trim();
      // Remove any markdown formatting and clean up
      description = description
        .replace(/\n+/g, ' ')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`([^`]+)`/g, '$1')
        .trim();

      // Truncate if too long (aim for ~150 characters)
      if (description.length > 150) {
        const truncated = description.substring(0, 147);
        const lastSpace = truncated.lastIndexOf(' ');
        description = (lastSpace > 100 ? truncated.substring(0, lastSpace) : truncated) + '...';
      }

      return description;
    }

    // Fallback: look for first meaningful line after title
    const lines = content.split('\n').filter(line => line.trim());
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('#') && !line.startsWith('Status:') && line.length > 10) {
        let description = line.replace(/\*\*/g, '').replace(/\*/g, '').trim();
        if (description.length > 150) {
          const truncated = description.substring(0, 147);
          const lastSpace = truncated.lastIndexOf(' ');
          description = (lastSpace > 100 ? truncated.substring(0, lastSpace) : truncated) + '...';
        }
        return description;
      }
    }

    return 'Smart contract upgrade deployment';
  } catch (error) {
    console.warn(error);
    return 'Smart contract upgrade deployment';
  }
}

function parseExecutionStatus(content: string): {
  status?: TaskStatus;
  executionLinks?: Array<{ url: string; label: string }>;
} {
  try {
    const lines = content.split('\n');

    // Find the status line - limit search to first 20 lines
    const statusLineIndex = lines
      .slice(0, 20)
      .findIndex(line => line.toLowerCase().includes('status:'));
    if (statusLineIndex === -1) return {};

    const statusLine = lines[statusLineIndex];
    const statusLower = statusLine.toLowerCase();

    // Check if it's executed
    if (!statusLower.includes(TaskStatus.Executed.toLowerCase())) {
      if (statusLower.includes(TaskStatus.ReadyToSign.toLowerCase())) {
        return { status: TaskStatus.ReadyToSign };
      }
      return { status: TaskStatus.Pending };
    }

    const executionLinks: Array<{ url: string; label: string }> = [];

    // Simple pattern matching - avoid complex regex
    if (statusLine.includes('(http')) {
      // Pattern 1: Status: EXECUTED (https://...)
      const urlStart = statusLine.indexOf('(http');
      const urlEnd = statusLine.indexOf(')', urlStart);
      if (urlEnd > urlStart) {
        const url = statusLine.substring(urlStart + 1, urlEnd);
        executionLinks.push({ url, label: 'Transaction' });
        return { status: TaskStatus.Executed, executionLinks };
      }
    }

    if (statusLine.includes(`[${TaskStatus.Executed}](http`)) {
      // Pattern 2: Status: [EXECUTED](https://...)
      const urlStart = statusLine.indexOf('](http') + 2;
      const urlEnd = statusLine.indexOf(')', urlStart);
      if (urlEnd > urlStart) {
        const url = statusLine.substring(urlStart, urlEnd);
        executionLinks.push({ url, label: 'Transaction' });
        return { status: TaskStatus.Executed, executionLinks };
      }
    }

    if (statusLine.includes(`${TaskStatus.Executed} http`)) {
      // Pattern 3: Status: EXECUTED https://...
      const urlStart = statusLine.indexOf('http');
      const url = statusLine.substring(urlStart).split(' ')[0];
      if (url.startsWith('http')) {
        executionLinks.push({ url, label: 'Transaction' });
        return { status: TaskStatus.Executed, executionLinks };
      }
    }

    // Pattern 4: Multi-line format - only check next 5 lines
    if (statusLower.includes(TaskStatus.Executed.toLowerCase()) && !statusLine.includes('http')) {
      for (let i = statusLineIndex + 1; i < Math.min(statusLineIndex + 6, lines.length); i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) break;

        if (line.includes('http') && line.includes(':')) {
          const colonIndex = line.indexOf(':');
          const label = line.substring(0, colonIndex).trim();
          const urlPart = line.substring(colonIndex + 1).trim();
          const url = urlPart.split(' ')[0];
          if (url.startsWith('http')) {
            executionLinks.push({ url, label });
          }
        }
      }

      if (executionLinks.length > 0) {
        return { status: TaskStatus.Executed, executionLinks };
      }
    }

    // If we detected EXECUTED but couldn't parse links, still mark as executed
    return { status: TaskStatus.Executed };
  } catch (error) {
    console.error('Error in parseExecutionStatus:', error);
    return {};
  }
}

export function getUpgradeOptions(network: NetworkType): DeploymentInfo[] {
  const contractDeploymentsPath = path.join(process.cwd(), '..');

  // Handle test network specially - load from validation-tool-interface/test-upgrade instead of root/test
  const networkPath = path.join(contractDeploymentsPath, network);

  try {
    // Check if the path exists
    if (!fs.existsSync(networkPath)) {
      console.error(`Network path does not exist: ${networkPath}`);
      return [];
    }

    const folders = fs
      .readdirSync(networkPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
      .filter(name => name.match(/^\d{4}-\d{2}-\d{2}-/)); // Only date-prefixed folders

    return folders
      .map(folderName => {
        try {
          const readmePath = path.join(networkPath, folderName, 'README.md');
          const name = formatUpgradeName(folderName);

          // Extract date from folder name (e.g., "2025-06-04-upgrade-system-config" -> "2025-06-04")
          const dateMatch = folderName.match(/^(\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : folderName.substring(0, 10);
          let description = '';

          if (!fs.existsSync(readmePath)) {
            return {
              id: folderName,
              name,
              description,
              date,
              network,
              status: undefined,
              executionLinks: undefined,
            };
          }

          // Add error handling and timeout for parsing
          let status, executionLinks;
          try {
            const content = fs.readFileSync(readmePath, 'utf-8');
            const parseResult = parseExecutionStatus(content);
            description = extractDescription(readmePath);
            status = parseResult.status;
            executionLinks = parseResult.executionLinks;
          } catch (parseError) {
            console.error(`Error parsing ${folderName}:`, parseError);
            status = undefined;
            executionLinks = undefined;
          }

          return {
            id: folderName,
            name,
            description,
            date,
            network,
            status,
            executionLinks,
          };
        } catch (itemError) {
          console.error(`Error processing folder ${folderName}:`, itemError);
          // Return a basic item if there's an error
          const dateMatch = folderName.match(/^(\d{4}-\d{2}-\d{2})/);
          const date = dateMatch ? dateMatch[1] : folderName.substring(0, 10);

          return {
            id: folderName,
            name: formatUpgradeName(folderName),
            description: 'Smart contract upgrade deployment',
            date,
            network,
            status: undefined,
            executionLinks: undefined,
          };
        }
      })
      .sort((a, b) => b.id.localeCompare(a.id)); // Sort by date (newest first)
  } catch (error) {
    console.error(`Error reading deployment folders for ${network}:`, error);
    return [];
  }
}

export function getAllUpgradeOptions(): DeploymentInfo[] {
  const mainnetOptions = getUpgradeOptions(NetworkType.Mainnet);
  const sepoliaOptions = getUpgradeOptions(NetworkType.Sepolia);

  return [...mainnetOptions, ...sepoliaOptions];
}
