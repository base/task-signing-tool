import fs from 'fs';
import path from 'path';
import { ConfigParser } from '@/lib/parser';
import { NextRequest, NextResponse } from 'next/server';

interface ConfigOption {
  fileName: string;
  displayName: string;
  configFile: string;
  ledgerId: number;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const network = url.searchParams.get('network');
    const upgradeId = url.searchParams.get('upgradeId');

    if (!network || !upgradeId) {
      return NextResponse.json(
        { error: 'Missing required parameters: network and upgradeId are required' },
        { status: 400 }
      );
    }

    const contractDeploymentsPath = path.join(process.cwd(), '..');

    // Handle test network specially - load from validation-tool-interface/test-upgrade instead of root/test
    const upgradePath = path.join(contractDeploymentsPath, network as string, upgradeId as string);

    const validationsPath = path.join(upgradePath, 'validations');

    if (!fs.existsSync(validationsPath)) {
      console.warn(`Validations path does not exist: ${validationsPath}`);
      return NextResponse.json({ configOptions: [] }, { status: 200 });
    }

    const configOptions: ConfigOption[] = [];
    const files = fs.readdirSync(validationsPath).filter(file => file.endsWith('.json'));

    for (const fileName of files) {
      // Parse filename to display name: "base-sc.json" → "Base Sc"
      const baseName = fileName.replace('.json', '');
      const displayName = baseName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      // Parse JSON file to extract ledger-id
      let ledgerId = 0; // Default fallback
      try {
        const filePath = path.join(validationsPath, fileName);
        const configContent = fs.readFileSync(filePath, 'utf-8');
        const parsedConfig = ConfigParser.parseFromString(configContent);

        if (parsedConfig.result.success) {
          ledgerId = parsedConfig.config['ledger-id'];
        } else {
          console.warn(`Failed to parse ${fileName}, using default ledger-id: 0`);
        }
      } catch (error) {
        console.warn(`Error reading ${fileName}, using default ledger-id: 0`, error);
      }

      configOptions.push({
        fileName: baseName, // "base-sc"
        displayName: displayName, // "Base Sc"
        configFile: fileName, // "base-sc.json"
        ledgerId: ledgerId, // Extracted from validation file
      });
    }

    console.log(
      `Found ${configOptions.length} config options for ${network}/${upgradeId}:`,
      configOptions.map(c => c.displayName)
    );

    return NextResponse.json({ configOptions }, { status: 200 });
  } catch (error) {
    console.error('Error fetching upgrade config:', error);
    return NextResponse.json({ error: 'Failed to fetch upgrade configuration' }, { status: 500 });
  }
}
