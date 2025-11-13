import { availableNetworks } from '@/lib/constants';
import { getUpgradeOptions } from '@/lib/deployments';
import { NetworkType, TaskStatus } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const networkParam = searchParams.get('network');
  const readyToSignOnly = searchParams.get('readyToSign') === 'true';

  // If no network param, return all ready-to-sign tasks across all networks
  if (!networkParam) {
    if (readyToSignOnly) {
      const allReadyToSignTasks = availableNetworks.flatMap(network => {
        const upgrades = getUpgradeOptions(network);
        return upgrades
          .filter(upgrade => upgrade.status === TaskStatus.ReadyToSign)
          .map(upgrade => ({
            ...upgrade,
            network: network,
          }));
      });
      // Sort by date (most recent first)
      return NextResponse.json(
        allReadyToSignTasks.sort((a, b) => b.id.localeCompare(a.id)),
        { status: 200 }
      );
    }
    return NextResponse.json({ error: 'Missing required network parameter' }, { status: 400 });
  }

  const network = networkParam.toLowerCase() as NetworkType;

  if (!availableNetworks.includes(network)) {
    return NextResponse.json({ error: `Invalid network parameter: ${network}` }, { status: 400 });
  }

  const upgrades = getUpgradeOptions(network);
  return NextResponse.json(upgrades, { status: 200 });
}
