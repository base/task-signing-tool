import { exec } from 'child_process';
import { promises as fs } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promisify } from 'util';
import { findContractDeploymentsRoot } from '@/lib/deployments';
import { assertWithinDir } from '@/lib/path-validation';

const execAsync = promisify(exec);
const INSTALL_DEPS_TIMEOUT_MS = 20 * 60 * 1000;

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
    const { network, forceInstall } = json;

    if (!network) {
      return NextResponse.json(
        { error: 'Missing required parameter: network is required' },
        { status: 400 }
      );
    }

    const actualNetwork = network.toLowerCase();
    const shouldForceInstall = Boolean(forceInstall);

    const safePathPattern = /^[a-zA-Z0-9_-]+$/;
    if (!safePathPattern.test(actualNetwork)) {
      return NextResponse.json(
        {
          error:
            'Invalid network: only alphanumeric characters, hyphens, and underscores are allowed',
        },
        { status: 400 }
      );
    }

    const contractDeploymentsPath = findContractDeploymentsRoot();
    const upgradePath = path.join(contractDeploymentsPath, 'active', 'evm');

    // Verify the resolved path is within the allowed directory
    let resolvedUpgradePath: string;
    try {
      resolvedUpgradePath = assertWithinDir(upgradePath, contractDeploymentsPath);
    } catch {
      return NextResponse.json({ error: 'Invalid path: access denied' }, { status: 403 });
    }

    const libPath = path.join(resolvedUpgradePath, 'lib');

    const upgradePathExists = await pathExists(resolvedUpgradePath);
    if (!upgradePathExists) {
      return NextResponse.json(
        { error: `Task folder not found: ${path.relative(contractDeploymentsPath, upgradePath)}` },
        { status: 404 }
      );
    }

    const libExistsBeforeInstall = await pathExists(libPath);

    if (!shouldForceInstall && libExistsBeforeInstall) {
      console.log(`Deps already installed for ${actualNetwork}; skipping.`);
      return NextResponse.json(
        {
          success: true,
          message: `Dependencies already installed for ${actualNetwork}`,
          libExists: true,
          installed: false,
          depsInstalled: false,
          stdout: '',
          stderr: '',
        },
        { status: 200 }
      );
    }

    console.log(`Installing dependencies for ${actualNetwork} (cwd: ${resolvedUpgradePath})`);

    const { stdout, stderr } = await execAsync('make deps', {
      cwd: resolvedUpgradePath,
      timeout: INSTALL_DEPS_TIMEOUT_MS,
      env: process.env,
    });

    console.log(`Dependencies installed for ${actualNetwork}`);

    // Verify that lib folder was created
    const libExistsAfterInstall = await pathExists(libPath);

    return NextResponse.json(
      {
        success: true,
        message: `Dependencies installed successfully for ${actualNetwork}`,
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
          'Dependency installation timed out (20 minutes). This upgrade may require manual setup.';
      } else if (error.message.includes('ENOENT')) {
        errorMessage = 'make command not found. Please ensure make is installed on the system.';
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
