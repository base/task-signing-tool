import {
  checkLedgerAvailability,
  LedgerSigningOptions,
  signDomainAndMessageHash,
} from '@/lib/ledger-signing';
import { HashSchema } from '@/lib/config-schemas';
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

    const domainResult = HashSchema.safeParse(domainHash);
    if (!domainResult.success) {
      return NextResponse.json(
        { error: `Invalid domainHash: ${domainResult.error.issues[0].message}` },
        { status: 400 }
      );
    }

    const messageResult = HashSchema.safeParse(messageHash);
    if (!messageResult.success) {
      return NextResponse.json(
        { error: `Invalid messageHash: ${messageResult.error.issues[0].message}` },
        { status: 400 }
      );
    }

    if (!Number.isInteger(ledgerAccount) || ledgerAccount < 0) {
      return NextResponse.json(
        { error: 'Invalid ledgerAccount: must be a non-negative integer' },
        { status: 400 }
      );
    }

    if (!(await checkLedgerAvailability())) {
      return NextResponse.json(
        {
          error: 'eip712sign binary not found. Install it and ensure it is on PATH or GOPATH/bin.',
        },
        { status: 500 }
      );
    }

    const result = await signDomainAndMessageHash({
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
