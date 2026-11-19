import { NextRequest, NextResponse } from 'next/server';
import { defaultTaskCatalog, TaskCatalogError } from '@/lib/task-catalog';

function errorResponse(error: unknown) {
  if (error instanceof TaskCatalogError) {
    const status = {
      'invalid-id': 400,
      'outside-root': 403,
      'not-found': 404,
      'invalid-profile': 500,
    }[error.kind];
    if (status !== 500) {
      return NextResponse.json({ error: error.message }, { status });
    }
  }
  console.error('Error fetching upgrade config:', error);
  return NextResponse.json({ error: 'Failed to fetch upgrade configuration' }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const network = url.searchParams.get('network');
  const upgradeId = url.searchParams.get('upgradeId');

  if (!network || !upgradeId) {
    return NextResponse.json(
      { error: 'Missing required parameters: network and upgradeId are required' },
      { status: 400 }
    );
  }

  try {
    const configOptions = defaultTaskCatalog().listProfiles(upgradeId, network);
    return NextResponse.json({ configOptions }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
