import { exec } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import { promisify } from 'util';
import {
  defaultTaskCatalog,
  TaskCatalogError,
  TASK_CATALOG_ERROR_STATUS,
} from '@/lib/task-catalog';

const execAsync = promisify(exec);
const INSTALL_DEPS_TIMEOUT_MS = 20 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { network, upgradeId } = json;

    if (!network || !upgradeId) {
      return NextResponse.json(
        { error: 'Missing required parameters: network and upgradeId are required' },
        { status: 400 }
      );
    }

    const actualNetwork = network.toLowerCase();

    const { taskDir } = defaultTaskCatalog().taskDirs(upgradeId, actualNetwork);

    console.log(`Installing dependencies for ${actualNetwork}/${upgradeId} (cwd: ${taskDir})`);

    // A task that holds several network configurations resolves its per-network
    // .env, and any network-specific dependency steps, from TASK_NETWORK, and
    // refuses to run without it. The catalog validates actualNetwork against
    // ^[a-zA-Z0-9_-]+$, so it is safe to interpolate into the command.
    await execAsync(`make TASK_NETWORK=${actualNetwork} deps`, {
      cwd: taskDir,
      timeout: INSTALL_DEPS_TIMEOUT_MS,
      env: process.env,
    });

    console.log(`Dependencies installed for ${actualNetwork}/${upgradeId}`);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof TaskCatalogError) {
      return NextResponse.json(
        { error: error.message },
        { status: TASK_CATALOG_ERROR_STATUS[error.kind] }
      );
    }

    console.error(`❌ Error installing dependencies:`, error);

    let errorMessage = 'Failed to install dependencies';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific error patterns to provide better user feedback
      if (error.message.includes('Command failed')) {
        errorMessage = `make deps command failed. ${error.message}`;
      } else if (error.message.includes('timeout')) {
        errorMessage =
          'Dependency installation timed out (20 minutes). This upgrade may require manual setup.';
      } else if (error.message.includes('ENOENT')) {
        errorMessage = 'make command not found. Please ensure make is installed on the system.';
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
