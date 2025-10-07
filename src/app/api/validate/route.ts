import { ValidationService } from '@/lib/validation-service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { upgradeId, network, userType } = json;

    if (!upgradeId || !network || !userType) {
      return NextResponse.json(
        { message: 'Missing required parameters: upgradeId, network, and userType are required' },
        { status: 400 }
      );
    }

    const actualNetwork = network.toLowerCase();

    console.log(`🔍 Starting validation for ${upgradeId} on ${actualNetwork} for ${userType}`);

    // Initialize ValidationService
    const validationService = new ValidationService();

    // Run validation with the RPC URL
    const validationResult = await validationService.validateUpgrade({
      upgradeId,
      network: actualNetwork,
      userType,
    });

    // Clean up temp files
    await validationService.cleanup({
      upgradeId,
      network: actualNetwork,
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

// Increase timeout for script execution
export const config = {
  api: {
    externalResolver: true,
    responseLimit: false,
  },
};
