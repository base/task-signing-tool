import { LedgerSigner, LedgerSigningOptions } from '@/lib/ledger-signing';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const {
      domainHash,
      messageHash,
      ledgerAccount = 0,
    } = (await req.json()) as Partial<LedgerSigningOptions>;

    if (!domainHash || !messageHash) {
      return NextResponse.json(
        { error: 'Missing required fields: domainHash, messageHash' },
        { status: 400 }
      );
    }

    const ledgerSigner = new LedgerSigner();

    if (!(await ledgerSigner.checkAvailability())) {
      return NextResponse.json(
        {
          error: 'eip712sign binary not found. Install it and ensure it is on PATH or GOPATH/bin.',
        },
        { status: 500 }
      );
    }

    const result = await ledgerSigner.signDomainAndMessageHash({
      domainHash,
      messageHash,
      ledgerAccount,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
