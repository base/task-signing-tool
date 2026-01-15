import os from 'os';
import path from 'path';
import { parseArgs } from 'node:util';
import { quote as shellQuote } from 'shell-quote';
import { spawn as spawnProcess } from 'child_process';
import { buildAndValidateSignature, createDeterministicTarball } from '@/lib/task-origin-validate';
import { TASK_ORIGIN_SIGNATURE_FILE_NAMES, TASK_ORIGIN_COMMON_NAMES } from '@/lib/constants';
import type { TaskOriginRole } from '@/lib/types';

const CERT_PATH = path.join(os.homedir(), '.ottr')
const DEVICE_CERT = "device-certificate.pem"
const DEVICE_CERT_KEY = "device-certificate-key.pem"

type FacilitatorType = 'base' | 'security-council';

function printUsage(): void {
    const msg = `
  Generate a task origin signature from a bundle.

  Commands:
    sign       Generate a signature for a task
    verify     Verify a signature for a task
    tar        Create a deterministic tarball from a task folder

  Usage:
    tsx scripts/genTaskOriginSig.ts <command> --task-folder <PATH> [--signature-path <PATH>] [--facilitator <TYPE>] [--common-name <COMMON_NAME>] [--help]

  Required flags:
    --task-folder, -t    Folder containing the task to tar and sign

  Optional flags:
    --signature-path, -s Directory path to store/read the signature
    --facilitator, -f    Facilitator type: "base" or "security-council" (omit for task creator)
    --common-name, -c    Common name to use for verification (only when not using --facilitator)
    --help, -h           Show this help message
  `;
    console.log(msg);
}

function spawn(command: string): Promise<number | null> {
    return new Promise((resolve, reject) => {
        // Execute through shell to support aliases and shell commands
        // The command must be properly escaped using shellQuote before calling this function
        const child = spawnProcess(command, {
            stdio: 'inherit',
            shell: true
        });
        child.on('error', (error) => {
            reject(new Error(`Failed to execute command: ${error.message}`));
        });
        child.on('close', (code) => {
            resolve(code);
        });
    });
}

function facilitatorToRole(facilitator: FacilitatorType | undefined): TaskOriginRole {
    if (!facilitator) {
        return 'taskCreator';
    }
    return facilitator === 'base' ? 'baseFacilitator' : 'securityCouncilFacilitator';
}

function facilitatorToGroup(facilitator: FacilitatorType): string {
    return facilitator === 'base' ? 'base-facilitators' : 'base-sc-facilitators';
}

async function signTask(
    taskFolderPath: string,
    signatureDir: string,
    facilitator: FacilitatorType | undefined
) {
    console.log('🔏 Signing task...');
    console.log(`  Task folder: ${taskFolderPath}`);

    const role = facilitatorToRole(facilitator);
    const signatureFileName = TASK_ORIGIN_SIGNATURE_FILE_NAMES[role];
    const signatureFileOut = path.join(signatureDir, signatureFileName);

    if (facilitator) {
        console.log(`  Facilitator: ${facilitator}`);
        console.log(`  Group: ${facilitatorToGroup(facilitator)}`);
    } else {
        console.log(`  Role: Task Creator`);
    }

    // Build device certificate command
    const certCommand = [
        'ottr-cli',
        'generate',
        'device-certificate',
        '--environment',
        'corporate',
        '--extended-key-usage=CodeSigningCertificate',
        '--certificate-path',
        DEVICE_CERT,
        '--private-key-path',
        DEVICE_CERT_KEY,
    ];

    // Add group flag for facilitators
    if (facilitator) {
        certCommand.push('--requested-sso-groups', facilitatorToGroup(facilitator));
    }

    let command = shellQuote(certCommand);
    let code = await spawn(command);
    if (code !== 0) {
        console.error(`  Error: Command failed with exit code ${code}`);
        process.exitCode = 1;
        return;
    }

    const certificatePath = path.join(CERT_PATH, DEVICE_CERT);
    const keyPath = path.join(CERT_PATH, DEVICE_CERT_KEY);
    const tarballPath = await createDeterministicTarball(taskFolderPath);
    console.log(`  Tarball: ${tarballPath}`);

    command = shellQuote([
        'ottr-cli',
        'generate',
        'signature',
        '--data',
        tarballPath,
        '--private-key',
        keyPath,
        '--certificate',
        certificatePath,
        '--bundle-output',
        signatureFileOut
    ]);
    code = await spawn(command);
    if (code !== 0) {
        console.error(`  Error: Command failed with exit code ${code}`);
        process.exitCode = 1;
        return;
    }

    console.log(`  Signature: ${signatureFileOut}`);
}

async function verifyTaskOrigin(
    taskFolderPath: string,
    signatureDir: string,
    facilitator: FacilitatorType | undefined,
    commonName: string | undefined
) {
    console.log('✅ Validating task signature...');

    const role = facilitatorToRole(facilitator);
    const signatureFileName = TASK_ORIGIN_SIGNATURE_FILE_NAMES[role];
    const signatureFile = path.join(signatureDir, signatureFileName);

    // Determine common name
    let actualCommonName: string;
    if (facilitator) {
        actualCommonName = TASK_ORIGIN_COMMON_NAMES[role === 'baseFacilitator' ? 'baseFacilitator' : 'securityCouncilFacilitator'];
        console.log(`  Facilitator: ${facilitator}`);
        console.log(`  Common Name: ${actualCommonName}`);
    } else {
        if (!commonName) {
            console.error('  Error: --common-name is required when not using --facilitator');
            process.exitCode = 1;
            return;
        }
        actualCommonName = commonName;
        console.log(`  Common Name: ${actualCommonName}`);
    }

    console.log(`  Signature File: ${signatureFile}`);

    try {
        await buildAndValidateSignature({ taskFolderPath, signatureFile, commonName: actualCommonName });
    } catch (error) {
        console.error('  Error:', error);
        process.exitCode = 1;
        return;
    }
}

async function main() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            'task-folder': { type: 'string', short: 't' },
            'signature-path': { type: 'string', short: 's' },
            'facilitator': { type: 'string', short: 'f' },
            'common-name': { type: 'string', short: 'c' },
            help: { type: 'boolean', short: 'h' },
        },
        allowPositionals: true,
    });

    if (values.help) {
        printUsage();
        return;
    }

    const command = positionals[0] as 'sign' | 'verify' | 'tar' | undefined;
    // Validate command is provided
    if (!command) {
        console.error('Error: No command specified.');
        printUsage();
        process.exitCode = 1;
        return;
    }

    // Validate command is recognized
    if (command !== 'sign' && command !== 'verify' && command !== 'tar') {
        console.error(`Error: Unknown command '${command}'.`);
        printUsage();
        process.exitCode = 1;
        return;
    }

    if (positionals.length > 1) {
        console.error('Error: Only one command is allowed.');
        printUsage();
        process.exitCode = 1;
        return;
    }

    const taskFolder = values['task-folder'];
    const signaturePath = values['signature-path'];
    const facilitatorValue = values['facilitator'];
    const commonName = values['common-name'];

    // Validate required task-folder flag
    if (!taskFolder) {
        console.error('Error: Missing required flag --task-folder.');
        printUsage();
        process.exitCode = 1;
        return;
    }

    // Validate facilitator value if provided
    let facilitator: FacilitatorType | undefined;
    if (facilitatorValue) {
        if (facilitatorValue !== 'base' && facilitatorValue !== 'security-council') {
            console.error(`Error: Invalid facilitator type '${facilitatorValue}'. Must be 'base' or 'security-council'.`);
            printUsage();
            process.exitCode = 1;
            return;
        }
        facilitator = facilitatorValue as FacilitatorType;
    }

    const taskFolderPath = path.resolve(process.cwd(), taskFolder);

    // Route to appropriate function based on command
    switch (command) {
        case 'sign': {
            const signatureDir = signaturePath
                ? path.resolve(process.cwd(), signaturePath)
                : taskFolderPath;

            await signTask(taskFolderPath, signatureDir, facilitator);
            break;
        }
        case 'verify': {
            // If not using facilitator, common-name is required
            if (!facilitator && !commonName) {
                console.error('Error: Either --facilitator or --common-name must be provided.');
                printUsage();
                process.exitCode = 1;
                return;
            }

            const signatureDir = signaturePath
                ? path.resolve(process.cwd(), signaturePath)
                : taskFolderPath;

            await verifyTaskOrigin(taskFolderPath, signatureDir, facilitator, commonName);
            break;
        }
        case 'tar': {
            const tarballPath = await createDeterministicTarball(taskFolderPath);
            console.log(`  Tarball: ${tarballPath}`);
            break;
        }
        default: {
            console.error(`Error: Unknown command '${command}'.`);
            printUsage();
            process.exitCode = 1;
            return;
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
