import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'node:util';
import { quote as shellQuote } from 'shell-quote';
import { spawn as spawnProcess } from 'child_process';
import { promises as fs } from 'fs';
import { X509Certificate } from 'crypto';
import { buildAndValidateSignature, createDeterministicTarball } from '@/lib/task-origin-validate';
import { TASK_ORIGIN_SIGNATURE_FILE_NAMES, TASK_ORIGIN_COMMON_NAMES } from '@/lib/constants';
import type { TaskOriginRole } from '@/lib/types';

const CERT_PATH = path.join(os.homedir(), '.ottr');
const DEVICE_CERT = 'device-certificate.pem';
const DEVICE_CERT_KEY = 'device-certificate-key.pem';

export type FacilitatorType = 'base' | 'security-council';
type VerificationResult = {
    role: TaskOriginRole;
    roleName: string;
    success: boolean;
    error?: string;
    signatureFile: string;
};

function printUsage(): void {
    const msg = `
  Generate a task origin signature from a bundle.

  Commands:
    sign         Generate a signature for a task
    verify       Verify a signature for a task
    verify-group Verify all three signatures (creator + both facilitators)
    tar          Create a deterministic tarball from a task folder

  Usage:
    tsx scripts/genTaskOriginSig.ts <command> --task-folder <PATH> [--signature-path <PATH>] [--facilitator <TYPE>] [--common-name <COMMON_NAME>] [--help]

  Required flags:
    --task-folder, -t    Folder containing the task to tar and sign

  Optional flags:
    --signature-path, -p Directory path to store/read the signature
    --facilitator, -f    Facilitator type: "base" or "security-council" (for 'sign' and 'verify' commands, omit for task creator)
    --common-name, -c    Common name for task creator (required for 'verify-group', or for 'verify' when not using --facilitator)
    --help, -h           Show this help message
  `;
    console.log(msg);
}

export function spawn(command: string): Promise<number | null> {
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

/**
 * Extracts the common name (email) from a task origin signature bundle.
 * The SAN in the certificate is expected to be in the format: user:///email@example.com
 */
export async function extractCommonNameFromSignature(signatureFile: string): Promise<string> {
    const bundleJSON = JSON.parse(await fs.readFile(signatureFile, 'utf8'));

    // Extract the leaf certificate (index 0) from the bundle
    const certificates = bundleJSON?.verificationMaterial?.x509CertificateChain?.certificates;
    if (!certificates || certificates.length === 0) {
        throw new Error('No certificates found in signature bundle');
    }

    // The leaf certificate is at index 0
    const leafCertBase64 = certificates[0]?.rawBytes;
    if (!leafCertBase64) {
        throw new Error('Leaf certificate rawBytes not found in bundle');
    }

    // Parse the X.509 certificate
    const certDer = Buffer.from(leafCertBase64, 'base64');
    const cert = new X509Certificate(new Uint8Array(certDer));

    // Extract the Subject Alternative Name (SAN)
    // The SAN is expected to be in format: URI:user:///email@example.com
    const san = cert.subjectAltName;
    if (!san) {
        throw new Error('No Subject Alternative Name found in certificate');
    }

    // Parse the SAN to extract the common name
    // SAN format: "URI:user:///email@example.com" or similar
    const uriMatch = san.match(/URI:user:\/\/\/([^,\s]+)/);
    if (!uriMatch) {
        throw new Error(`Could not extract common name from SAN: ${san}`);
    }

    return uriMatch[1];
}

export function facilitatorToRole(facilitator: FacilitatorType | undefined): TaskOriginRole {
    if (!facilitator) {
        return 'taskCreator';
    }
    return facilitator === 'base' ? 'baseFacilitator' : 'securityCouncilFacilitator';
}

export function facilitatorToGroup(facilitator: FacilitatorType): string {
    return facilitator === 'base' ? 'base-facilitators' : 'base-sc-facilitators';
}

/**
 * Signs a task folder and returns the signature file path.
 * Returns undefined if the signing fails.
 */
export async function signTask(
    taskFolderPath: string,
    signatureDir: string,
    facilitator: FacilitatorType | undefined
): Promise<string | undefined> {
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
        return undefined;
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
        return undefined;
    }

    console.log(`  Signature: ${signatureFileOut}`);
    return signatureFileOut;
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
        await buildAndValidateSignature({ taskFolderPath, signatureFile, commonName: actualCommonName, role });
    } catch (error) {
        console.error('  Error:', error);
        process.exitCode = 1;
        return;
    }
}

async function verifyGroupSignatures(
    taskFolderPath: string,
    signatureDir: string,
    taskCreatorCommonName: string
) {
    console.log('📋 Validating all task signatures...');
    console.log(`  Task folder: ${taskFolderPath}`);
    console.log(`  Signature directory: ${signatureDir}`);

    const results: VerificationResult[] = [];
    const roleDisplayNames: Record<TaskOriginRole, string> = {
        taskCreator: 'Task Creator',
        baseFacilitator: 'Base Facilitator',
        securityCouncilFacilitator: 'Security Council Facilitator',
    };

    // Verify all three roles: task creator + both facilitators
    const allRoles: TaskOriginRole[] = ['taskCreator', 'baseFacilitator', 'securityCouncilFacilitator'];

    for (const role of allRoles) {
        const roleName = roleDisplayNames[role];
        const signatureFileName = TASK_ORIGIN_SIGNATURE_FILE_NAMES[role];
        const signatureFile = path.join(signatureDir, signatureFileName);

        // Determine common name for this role
        const commonName = role === 'taskCreator'
            ? taskCreatorCommonName
            : TASK_ORIGIN_COMMON_NAMES[role];

        try {
            // Check if signature file exists
            await fs.access(signatureFile);

            // Validate the signature
            await buildAndValidateSignature({
                taskFolderPath,
                signatureFile,
                commonName,
                role,
            });

            results.push({
                role,
                roleName,
                success: true,
                signatureFile,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            results.push({
                role,
                roleName,
                success: false,
                error: errorMessage,
                signatureFile,
            });
        }
    }

    // Print results summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 VERIFICATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);

    if (successes.length > 0) {
        console.log('✅ PASSED:');
        for (const result of successes) {
            console.log(`  ✓ ${result.roleName}`);
            console.log(`    File: ${result.signatureFile}`);
        }
    }

    if (failures.length > 0) {
        console.log('❌ FAILED:');
        for (const result of failures) {
            console.log(`  ✗ ${result.roleName}`);
            console.log(`    File: ${result.signatureFile}`);
            console.log(`    Error: ${result.error}`);
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`TOTAL: ${successes.length}/${results.length} signatures valid`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Set exit code if any failures
    if (failures.length > 0) {
        process.exitCode = 1;
    }
}

async function main() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            'task-folder': { type: 'string', short: 't' },
            'signature-path': { type: 'string', short: 'p' },
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

    const command = positionals[0] as 'sign' | 'verify' | 'verify-group' | 'tar' | undefined;
    // Validate command is provided
    if (!command) {
        console.error('Error: No command specified.');
        printUsage();
        process.exitCode = 1;
        return;
    }

    // Validate command is recognized
    if (command !== 'sign' && command !== 'verify' && command !== 'verify-group' && command !== 'tar') {
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

            const signatureFile = await signTask(taskFolderPath, signatureDir, facilitator);
            if (!signatureFile) {
                process.exitCode = 1;
            }
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
        case 'verify-group': {
            // Require common-name for task creator verification
            if (!commonName) {
                console.error('Error: --common-name is required for verify-group command (used for task creator validation).');
                printUsage();
                process.exitCode = 1;
                return;
            }

            const signatureDir = signaturePath
                ? path.resolve(process.cwd(), signaturePath)
                : taskFolderPath;

            await verifyGroupSignatures(taskFolderPath, signatureDir, commonName);
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

// Only run main() when this script is executed directly, not when imported
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(err => {
        console.error(err);
        process.exitCode = 1;
    });
}
