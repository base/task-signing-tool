import fs from 'fs';
import path from 'path';
import { NetworkType, TaskStatus } from './types';

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
    // Normalize line endings to avoid CRLF-related mismatches
    const normalized = content.replace(/\r\n/g, '\n');

    // Look for description after a "## Description" header (case-insensitive)
    // Capture everything after the header until the next line that starts with "##" or EOF
    const descriptionMatch = normalized.match(/##\s*Description[^\n]*\n([\s\S]*?)(?=\n##\s+|$)/i);
    if (descriptionMatch) {
      const block = descriptionMatch[1];
      // Preserve paragraphs and blank lines; trim trailing spaces per line and strip leading/trailing blank lines
      const cleaned = block.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '');
      return cleaned;
    }

    // Fallback: capture from the first meaningful line until the next "##" header or EOF
    const lines = normalized.split('\n');
    let startIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // skip empty
      if (line.startsWith('#')) continue; // skip headings
      if (/^status\s*:/i.test(line)) continue; // skip status lines
      startIndex = i;
      break;
    }

    if (startIndex !== -1) {
      let endIndex = lines.length;
      for (let j = startIndex + 1; j < lines.length; j++) {
        if (/^[\t ]*##\s+/.test(lines[j])) {
          endIndex = j;
          break;
        }
      }

      const descriptionBlock = lines.slice(startIndex, endIndex).join('\n');
      const cleaned = descriptionBlock.replace(/[ \t]+$/gm, '').replace(/^\n+|\n+$/g, '');
      if (cleaned) {
        return cleaned;
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
            description = extractDescription(content);
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
