import { getUpgradeOptions } from '@/lib/deployments';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const network = url.searchParams.get('network');

    const actualNetwork = (network as string).toLowerCase() as 'mainnet' | 'sepolia';
    const ACCEPTED_NETWORKS = ['mainnet', 'sepolia'];

    if (!ACCEPTED_NETWORKS.includes(actualNetwork)) {
      return NextResponse.json(
        { error: 'Invalid network parameter. Must be "mainnet", "sepolia", or "test"' },
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
