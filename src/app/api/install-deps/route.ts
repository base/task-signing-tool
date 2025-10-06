import { exec } from 'child_process';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    // Construct the path to the upgrade folder and lib subdirectory
    const contractDeploymentsPath = path.join(process.cwd(), '..');

    // Handle test network specially - load from validation-tool-interface/test-upgrade instead of root/test
    const upgradePath = path.join(contractDeploymentsPath, actualNetwork, upgradeId);
    const libPath = path.join(upgradePath, 'lib');

    // Check if the upgrade folder exists
    if (!fs.existsSync(upgradePath)) {
      return NextResponse.json(
        { error: `Upgrade folder not found: ${network}/${upgradeId}` },
        { status: 404 }
      );
    }

    console.log('Installing dependencies...');
    console.log(`Working directory: ${upgradePath}`);

    // Run make deps in the upgrade folder
    const { stdout, stderr } = await execAsync('make deps', {
      cwd: upgradePath,
      timeout: 300000, // 5 minutes timeout
      env: {
        ...process.env,
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
      },
    });

    console.log(`✅ Dependencies installed successfully for ${actualNetwork}/${upgradeId}`);

    if (stdout) {
      console.log('📤 stdout:', stdout);
    }

    if (stderr) {
      console.log('📤 stderr:', stderr);
    }

    // Verify that lib folder was created
    const libExistsAfterInstall = fs.existsSync(libPath);

    if (!libExistsAfterInstall) {
      console.warn(`⚠️ Warning: lib folder still doesn't exist after running make deps`);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Dependencies installed successfully for ${actualNetwork}/${upgradeId}`,
        libExists: libExistsAfterInstall,
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

// Increase timeout for dependency installation
export const config = {
  api: {
    externalResolver: true,
    responseLimit: false,
  },
};
