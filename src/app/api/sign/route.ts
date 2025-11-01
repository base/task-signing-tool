import { LedgerSigner, LedgerSigningOptions } from '@/lib/ledger-signing';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { domainHash, messageHash, ledgerAccount } = json as {
      domainHash?: string;
      messageHash?: string;
      ledgerAccount?: number;
    };

    console.log('🔐 Starting Ledger sign operation');

    // Initialize Ledger signer
    const ledgerSigner = new LedgerSigner();

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
      console.log(`✅ Successfully signed with Ledger. Signer: ${result.signer}`);
      return NextResponse.json(
        {
          success: true,
          signature: result.signature,
          signer: result.signer,
          data: result.data,
        },
        { status: 200 }
      );
    } else {
      console.error('❌ Failed to sign with Ledger:', result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Ledger signing API error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
