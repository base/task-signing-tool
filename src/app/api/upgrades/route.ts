import { availableNetworks } from '@/lib/constants';
import { getUpgradeOptions } from '@/lib/deployments';
import { NetworkType } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const networkParam = searchParams.get('network');

  if (!networkParam) {
    return NextResponse.json({ error: 'Missing required network parameter' }, { status: 400 });
  }

  const network = networkParam.toLowerCase() as NetworkType;

  if (!availableNetworks.includes(network)) {
    return NextResponse.json({ error: `Invalid network parameter: ${network}` }, { status: 400 });
  }

  const upgrades = getUpgradeOptions(network);
  return NextResponse.json(upgrades, { status: 200 });
}
