import { availableNetworks } from '@/lib/constants';
import { getUpgradeOptions } from '@/lib/deployments';
import { NetworkType } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const network = url.searchParams.get('network');

    const actualNetwork = network?.toLowerCase() as NetworkType;

    if (!availableNetworks.includes(actualNetwork)) {
      return NextResponse.json(
        { error: `Invalid network parameter: ${actualNetwork}` },
        { status: 400 }
      );
    }
    const upgrades = getUpgradeOptions(actualNetwork);
    return NextResponse.json(upgrades, { status: 200 });
  } catch (error) {
    console.error('Error fetching upgrades:', error);
    return NextResponse.json({ error: 'Failed to fetch upgrades' }, { status: 500 });
  }
}
