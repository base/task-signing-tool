import { LedgerSigner, LedgerSigningOptions } from '@/lib/ledger-signing';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { action, domainHash, messageHash, ledgerAccount, eip712signPath } = json.body as {
      action: 'get-address' | 'sign';
      domainHash?: string;
      messageHash?: string;
      ledgerAccount?: number;
      eip712signPath?: string;
    };

    // Validate required fields
    if (!action) {
      return NextResponse.json({ error: 'Missing required field: action' }, { status: 400 });
    }

    console.log(`🔐 Starting Ledger ${action} operation`);

    // Initialize Ledger signer
    const ledgerSigner = new LedgerSigner(eip712signPath);

    // Check if eip712sign is available
    const isAvailable = await ledgerSigner.checkAvailability();
    if (!isAvailable) {
      return NextResponse.json(
        {
          error:
            'eip712sign binary not found. Please ensure it is installed and in your PATH or GOPATH/bin.',
        },
        { status: 500 }
      );
    }

    if (action === 'get-address') {
      // Get address from Ledger device
      const result = await ledgerSigner.getAddress(ledgerAccount || 0);

      if (result.success) {
        console.log(`✅ Successfully retrieved Ledger address: ${result.address}`);
        return NextResponse.json({ success: true, address: result.address }, { status: 200 });
      } else {
        console.error('❌ Failed to get Ledger address:', result.error);
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
    } else if (action === 'sign') {
      // Validate signing parameters
      if (!domainHash || !messageHash) {
        return NextResponse.json(
          { error: 'Missing required fields for signing: domainHash, messageHash' },
          { status: 400 }
        );
      }

      const signingOptions: LedgerSigningOptions = {
        domainHash,
        messageHash,
        ledgerAccount: ledgerAccount || 0,
      };

      // Sign with Ledger device
      const result = await ledgerSigner.signDomainAndMessageHash(signingOptions);

      if (result.success) {
        console.log(`✅ Successfully signed with Ledger. Signer: ${result.signerAddress}`);
        return NextResponse.json(
          {
            success: true,
            signature: result.signature,
            signerAddress: result.signerAddress,
          },
          { status: 200 }
        );
      } else {
        console.error('❌ Failed to sign with Ledger:', result.error);
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "get-address" or "sign"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('❌ Ledger signing API error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
