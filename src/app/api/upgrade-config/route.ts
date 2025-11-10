import { promises as fs } from 'fs';
import path from 'path';
import { ConfigParser } from '@/lib/parser';
import { NextRequest, NextResponse } from 'next/server';

const toDisplayName = (name: string) =>
  name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const network = url.searchParams.get('network');
  const upgradeId = url.searchParams.get('upgradeId');

  if (!network || !upgradeId) {
    return NextResponse.json(
      { error: 'Missing required parameters: network and upgradeId are required' },
      { status: 400 }
    );
  }

  const validationsPath = path.resolve(process.cwd(), '..', network, upgradeId, 'validations');

  try {
    const entries = await fs.readdir(validationsPath);
    const jsonFiles = entries.filter(file => file.endsWith('.json'));

    const configOptions = await Promise.all(
      jsonFiles.map(async configFile => {
        const baseName = configFile.replace(/\.json$/, '');
        const displayName = toDisplayName(baseName);
        const filePath = path.join(validationsPath, configFile);

        try {
          const configContent = await fs.readFile(filePath, 'utf-8');
          const parsedConfig = ConfigParser.parseFromString(configContent);

          if (parsedConfig.result.success) {
            return {
              fileName: baseName,
              displayName,
              configFile,
              ledgerId: parsedConfig.config.ledgerId,
            };
          }

          console.warn(`Failed to parse ${configFile}, using default ledgerId: 0`);
        } catch (error) {
          console.warn(`Error reading ${configFile}, using default ledgerId: 0`, error);
        }

        return {
          fileName: baseName,
          displayName,
          configFile,
          ledgerId: 0,
        };
      })
    );

    console.log(
      `Found ${configOptions.length} config options for ${network}/${upgradeId}:`,
      configOptions.map(c => c.displayName)
    );

    return NextResponse.json({ configOptions }, { status: 200 });
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err?.code === 'ENOENT') {
      console.warn(`Validations path does not exist: ${validationsPath}`);
      return NextResponse.json({ configOptions: [] }, { status: 200 });
    }

    console.error('Error fetching upgrade config:', error);
    return NextResponse.json({ error: 'Failed to fetch upgrade configuration' }, { status: 500 });
  }
}
