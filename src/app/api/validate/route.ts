import { validateUpgrade } from '@/lib/validation-service';
import { NextRequest, NextResponse } from 'next/server';
import { NetworkType } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { upgradeId, network, userType } = json;

    if (
      typeof upgradeId !== 'string' ||
      typeof network !== 'string' ||
      typeof userType !== 'string' ||
      !upgradeId.trim() ||
      !network.trim() ||
      !userType.trim()
    ) {
      return NextResponse.json(
        { message: 'Missing required parameters: upgradeId, network, and userType are required' },
        { status: 400 }
      );
    }

    const trimmedUpgradeId = upgradeId.trim();
    const trimmedUserType = userType.trim();
    const normalizedNetwork = network.trim().toLowerCase();

    if (!Object.values(NetworkType).includes(normalizedNetwork as NetworkType)) {
      return NextResponse.json(
        {
          message: `Unsupported network: ${network}. Supported networks are ${Object.values(
            NetworkType
          ).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const validationResult = await validateUpgrade({
      upgradeId: trimmedUpgradeId,
      network: normalizedNetwork as NetworkType,
      taskConfigFileName: trimmedUserType,
    });

    return NextResponse.json({ success: true, data: validationResult }, { status: 200 });
  } catch (error) {
    console.error('Validation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    );
  }
}
