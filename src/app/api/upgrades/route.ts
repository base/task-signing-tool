import { availableNetworks } from '@/lib/constants';
import { getUpgradeOptions } from '@/lib/deployments';
import { TaskStatus } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  if (searchParams.get('readyToSign') !== 'true') {
    return NextResponse.json({ error: 'Missing required parameter: readyToSign' }, { status: 400 });
  }

  const allReadyToSignTasks = availableNetworks.flatMap(network => {
    const upgrades = getUpgradeOptions(network);
    return upgrades
      .filter(upgrade => upgrade.status === TaskStatus.ReadyToSign)
      .map(upgrade => ({ ...upgrade, network }));
  });

  // Sort by id (newest first) across all networks; per-network lists are sorted independently.
  allReadyToSignTasks.sort((a, b) => b.id.localeCompare(a.id));
  return NextResponse.json(allReadyToSignTasks, { status: 200 });
}
