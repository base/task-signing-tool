import {
  checkLedgerAvailability,
  LedgerSigningOptions,
  signDomainAndMessageHash,
} from '@/lib/ledger-signing';
import { signSafeTxWithTrezor } from '@/lib/trezor-signing';
import { SafeTxTypedDataSchema, safeTxTypedDataMatches } from '@/lib/safe-typed-data';
import { HashSchema } from '@/lib/config-schemas';
import type { HardwareWallet } from '@/lib/types/signing';
import { NextRequest, NextResponse } from 'next/server';

type SignRequestBody = Partial<LedgerSigningOptions> & {
  device?: HardwareWallet;
  typedData?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const {
      domainHash,
      messageHash,
      ledgerAccount = 0,
      device = 'ledger',
      typedData,
    } = (await req.json()) as SignRequestBody;

    if (device !== 'ledger' && device !== 'trezor') {
      return NextResponse.json(
        { error: "Invalid device: must be 'ledger' or 'trezor'" },
        { status: 400 }
      );
    }

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

    if (device === 'trezor') {
      const parsed = SafeTxTypedDataSchema.safeParse(typedData);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return NextResponse.json(
          {
            error: `Invalid typedData: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'missing'}`,
          },
          { status: 400 }
        );
      }

      // The device signs the typed data, so it must hash to exactly what was validated.
      if (!safeTxTypedDataMatches(parsed.data, { domainHash, messageHash })) {
        return NextResponse.json(
          { error: 'typedData does not hash to the provided domainHash/messageHash' },
          { status: 400 }
        );
      }

      const result = await signSafeTxWithTrezor({
        typedData: parsed.data,
        accountIndex: ledgerAccount,
      });
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json(result, { status: 200 });
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
