import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

const INSTALL_CACHE_ROOT = path.join(os.tmpdir(), 'task-signing-tool', 'install-deps');
const INSTALL_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

interface InstallCacheEntry {
  installedAt?: string;
  source?: string;
  libExistsAfterInstall?: boolean;
}

const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const sanitizeForFilename = (value: string) => value.replace(/[^a-zA-Z0-9-_]/g, '_');

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

    // Construct the path to the upgrade folder and lib subdirectory
    const contractDeploymentsPath = path.join(process.cwd(), '..');
    const upgradePath = path.join(contractDeploymentsPath, actualNetwork, upgradeId);
    const libPath = path.join(upgradePath, 'lib');

    // Check if the upgrade folder exists
    if (!fs.existsSync(upgradePath)) {
      return NextResponse.json(
        { error: `Upgrade folder not found: ${network}/${upgradeId}` },
        { status: 404 }
      );
    }

    ensureDirectoryExists(INSTALL_CACHE_ROOT);
    const networkCacheDir = path.join(INSTALL_CACHE_ROOT, sanitizeForFilename(actualNetwork));
    ensureDirectoryExists(networkCacheDir);
    const installCachePath = path.join(networkCacheDir, `${sanitizeForFilename(upgradeId)}.json`);

    const libExistsBeforeInstall = fs.existsSync(libPath);
    const cacheFileExisted = fs.existsSync(installCachePath);
    let hasSuccessfulInstallCache = false;

    if (cacheFileExisted) {
      try {
        const rawCache = await fs.promises.readFile(installCachePath, 'utf8');
        const cacheEntry = JSON.parse(rawCache) as InstallCacheEntry;
        const installedAt = cacheEntry?.installedAt ? new Date(cacheEntry.installedAt) : null;
        const installedAtMs = installedAt ? installedAt.getTime() : Number.NaN;

        if (!Number.isNaN(installedAtMs)) {
          const cacheAgeMs = Date.now() - installedAtMs;
          if (cacheAgeMs <= INSTALL_CACHE_TTL_MS) {
            hasSuccessfulInstallCache = true;
          } else {
            const cacheAgeMinutes = Math.round(cacheAgeMs / 60000);
            const ttlMinutes = Math.round(INSTALL_CACHE_TTL_MS / 60000);
            console.log(
              `Install cache expired for ${actualNetwork}/${upgradeId}: ${cacheAgeMinutes} minutes old (TTL ${ttlMinutes} minutes).`
            );
            await fs.promises.unlink(installCachePath).catch(unlinkError => {
              if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
                console.warn(
                  `⚠️ Warning: Failed to delete expired install cache for ${actualNetwork}/${upgradeId}:`,
                  unlinkError
                );
              }
            });
          }
        } else {
          console.warn(
            `⚠️ Warning: Install cache for ${actualNetwork}/${upgradeId} has an invalid installedAt value. Ignoring cache.`
          );
          await fs.promises.unlink(installCachePath).catch(unlinkError => {
            if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
              console.warn(
                `⚠️ Warning: Failed to delete invalid install cache for ${actualNetwork}/${upgradeId}:`,
                unlinkError
              );
            }
          });
        }
      } catch (cacheError) {
        console.warn(
          `⚠️ Warning: Could not parse install cache for ${actualNetwork}/${upgradeId}, ignoring cache.`,
          cacheError
        );
        await fs.promises.unlink(installCachePath).catch(unlinkError => {
          if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.warn(
              `⚠️ Warning: Failed to delete unreadable install cache for ${actualNetwork}/${upgradeId}:`,
              unlinkError
            );
          }
        });
      }
    }

    if (!shouldForceInstall && hasSuccessfulInstallCache && libExistsBeforeInstall) {
      console.log(
        `Skipping dependency installation for ${actualNetwork}/${upgradeId}: cached successful install found.`
      );

      return NextResponse.json(
        {
          success: true,
          message: `Dependencies already installed for ${actualNetwork}/${upgradeId}`,
          libExists: libExistsBeforeInstall,
          depsInstalled: true,
          installationSkipped: true,
          alreadyInstalled: true,
          stdout: 'make deps skipped - cached successful install',
          stderr: '',
        },
        { status: 200 }
      );
    }

    console.log(
      `Installing dependencies${
        shouldForceInstall ? ' (force reinstall requested)' : ''
      } for ${actualNetwork}/${upgradeId}...`
    );
    console.log(`Working directory: ${upgradePath}`);

    // Run make deps in the upgrade folder
    const { stdout, stderr } = await execAsync('make deps', {
      cwd: upgradePath,
      timeout: 300000, // 5 minutes timeout
      env: process.env,
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

    try {
      await fs.promises.writeFile(
        installCachePath,
        JSON.stringify(
          {
            installedAt: new Date().toISOString(),
            source: shouldForceInstall ? 'force-install' : 'fresh-install',
            libExistsAfterInstall,
          },
          null,
          2
        ),
        'utf8'
      );
    } catch (cacheError) {
      console.warn(
        `⚠️ Warning: Failed to write install cache for ${actualNetwork}/${upgradeId}:`,
        cacheError
      );
    }

    if (!libExistsAfterInstall) {
      console.warn(`⚠️ Warning: lib folder still doesn't exist after running make deps`);
    }

    return NextResponse.json(
      {
        success: true,
        message: `Dependencies installed successfully for ${actualNetwork}/${upgradeId}`,
        libExists: libExistsAfterInstall,
        depsInstalled: true,
        installationSkipped: false,
        alreadyInstalled: false,
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
