import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promisify } from 'util';
import { findContractDeploymentsRoot } from '@/lib/deployments';
import { assertWithinDir } from '@/lib/path-validation';

const execAsync = promisify(exec);

const pathExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { network, upgradeId, forceInstall } = json;

    if (!network || !upgradeId) {
      return NextResponse.json(
        { error: 'Missing required parameters: network and upgradeId are required' },
        { status: 400 }
      );
    }

    const actualNetwork = network.toLowerCase();
    const shouldForceInstall = Boolean(forceInstall);

    // Validate inputs to prevent path traversal attacks
    // Only allow alphanumeric characters, hyphens, and underscores
    const safePathPattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePathPattern.test(actualNetwork) || !safePathPattern.test(upgradeId)) {
      return NextResponse.json(
        {
          error:
            'Invalid network or upgradeId: only alphanumeric characters, hyphens, and underscores are allowed',
        },
        { status: 400 }
      );
    }

    // Construct the path to the upgrade folder and lib subdirectory
    const contractDeploymentsPath = findContractDeploymentsRoot();
    const upgradePath = path.join(contractDeploymentsPath, actualNetwork, upgradeId);

    // Verify the resolved path is within the allowed directory
    let resolvedUpgradePath: string;
    try {
      resolvedUpgradePath = assertWithinDir(upgradePath, contractDeploymentsPath);
    } catch {
      return NextResponse.json({ error: 'Invalid path: access denied' }, { status: 403 });
    }

    const libPath = path.join(resolvedUpgradePath, 'lib');

    // Check if the upgrade folder exists
    const upgradePathExists = await pathExists(resolvedUpgradePath);
    if (!upgradePathExists) {
      return NextResponse.json(
        { error: `Upgrade folder not found: ${network}/${upgradeId}` },
        { status: 404 }
      );
    }

    const libExistsBeforeInstall = await pathExists(libPath);

    if (!shouldForceInstall && libExistsBeforeInstall) {
      console.log(`Deps already installed for ${actualNetwork}/${upgradeId}; skipping.`);
      return NextResponse.json(
        {
          success: true,
          message: `Dependencies already installed for ${actualNetwork}/${upgradeId}`,
          libExists: true,
          installed: false,
          depsInstalled: false,
          stdout: '',
          stderr: '',
        },
        { status: 200 }
      );
    }

    console.log(
      `Installing dependencies for ${actualNetwork}/${upgradeId} (cwd: ${resolvedUpgradePath})`
    );

    // Run make deps in the upgrade folder
    const { stdout, stderr } = await execAsync('make deps', {
      cwd: resolvedUpgradePath,
      timeout: 300000, // 5 minutes timeout
      env: process.env,
    });

    console.log(`Dependencies installed for ${actualNetwork}/${upgradeId}`);

    // Verify that lib folder was created
    const libExistsAfterInstall = await pathExists(libPath);

    return NextResponse.json(
      {
        success: true,
        message: `Dependencies installed successfully for ${actualNetwork}/${upgradeId}`,
        libExists: libExistsAfterInstall,
        installed: true,
        depsInstalled: true,
        stdout: stdout || '',
        stderr: stderr || '',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`❌ Error installing dependencies:`, error);

    let errorMessage = 'Failed to install dependencies';

    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific error patterns to provide better user feedback
      if (error.message.includes('Command failed')) {
        errorMessage = `make deps command failed. ${error.message}`;
      } else if (error.message.includes('timeout')) {
        errorMessage =
          'Dependency installation timed out (5 minutes). This upgrade may require manual setup.';
      } else if (error.message.includes('ENOENT')) {
        errorMessage = 'make command not found. Please ensure make is installed on the system.';
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
