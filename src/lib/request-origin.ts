import { NextRequest, NextResponse } from 'next/server';

const SAFE_FETCH_SITE_VALUES = new Set(['same-origin', 'none']);

export function rejectCrossOriginRequest(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }

  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite && !SAFE_FETCH_SITE_VALUES.has(secFetchSite.toLowerCase())) {
    return NextResponse.json({ error: 'Cross-origin requests are not allowed' }, { status: 403 });
  }

  return null;
}
