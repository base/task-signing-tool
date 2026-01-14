import path from 'path';
import { parseArgs } from 'node:util';
import { quote as shellQuote } from 'shell-quote';
import { spawn as spawnProcess } from 'child_process';
import { buildAndValidateSignature, createDeterministicTarball } from '@/lib/task-origin-validate';

function printUsage(): void {
    const msg = `
  Generate a task origin signature from a bundle.

  Commands:
    sign       Generate a signature for a task
    verify     Verify a signature for a task
    tar        Create a deterministic tarball from a task folder

  Usage:
    tsx scripts/genTaskOriginSig.ts <command> --task-folder <PATH> --signature-path <PATH> [--common-name <COMMON_NAME>] [--help]

  Optional flags:
    --task-folder, -t    Folder containing the task to tar and sign
    --signature-path, -s Path to store the signature output and read the signature from
    --common-name, -c    Common name to use for verification
    --help, -h           Show this help message
  `;
    console.log(msg);
}

function spawn(command: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
        // Execute through shell to support aliases and shell commands
        // The command must be properly escaped using shellQuote before calling this function
        const child = spawnProcess(command, {
            stdio: ['inherit', 'pipe', 'pipe'],  // inherit stdin to allow user input
            shell: true
        });
        let stdout = '';
        let stderr = '';

        // Capture stdout silently for parsing, display stderr for user interaction
        child.stdout.on('data', (d) => {
            const chunk = d.toString();
            stdout += chunk;
            // Don't display stdout - we only need it for parsing certificate paths
        });
        child.stderr.on('data', (d) => {
            const chunk = d.toString();
            stderr += chunk;
            process.stderr.write(chunk);  // Show prompts and logs to user in real-time
        });
        child.on('error', (error) => {
            reject(new Error(`Failed to execute command: ${error.message}`));
        });
        child.on('close', (code) => {
            resolve({ stdout, stderr, code });
        });
    });
}

async function signTask(taskFolderPath: string, signatureFileOut: string) {
    console.log('🔏 Signing task...');
    console.log(`  Task folder: ${taskFolderPath}`);

    let command = shellQuote([
        'ottr-cli',
        'generate',
        'device-certificate',
        '--environment',
        'corporate',
        '--extended-key-usage=CodeSigningCertificate'
    ]);
    let { stderr, code } = await spawn(command);
    if (code !== 0) {
        console.error(`  Error: Command failed with exit code ${code}`);
        process.exitCode = 1;
        return;
    }

    // Parse certificate and key paths from stderr (where the cli tool logs them)
    const lines = stderr.trim().split('\n').filter(line => line.includes('saved to'));
    const certificatePath = lines.find(l => l.includes('device certificate saved'))?.split(' ').pop() || '';
    const keyPath = lines.find(l => l.includes('private key saved'))?.split(' ').pop() || '';
    console.log(`  Certificate: ${certificatePath}`);
    console.log(`  Key: ${keyPath}`);

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
    ({ code } = await spawn(command));
    if (code !== 0) {
        console.error(`  Error: Command failed with exit code ${code}`);
        process.exitCode = 1;
        return;
    }

    console.log(`  Signature: ${signatureFileOut}`);    
}

async function verifyTaskOrigin(taskFolderPath: string, signatureFile: string, commonName: string) {
    console.log('✅ Validating task signature...');

    try {
        await buildAndValidateSignature({ taskFolderPath, signatureFile, commonName });
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
    const commonName = values['common-name'];

    // Route to appropriate function based on command
    switch (command) {
        case 'sign': {
            if (!taskFolder || !signaturePath) {
                console.error('Error: Missing required flags.');
                printUsage();
                process.exitCode = 1;
                return;
            }

            const taskFolderPath = path.resolve(process.cwd(), taskFolder);
            const signatureFileOut = path.resolve(process.cwd(), signaturePath);

            await signTask(taskFolderPath, signatureFileOut);
            break;
        }
        case 'verify': {
            if (!taskFolder || !signaturePath || !commonName) {
                console.error('Error: Missing required flags.');
                printUsage();
                process.exitCode = 1;
                return;
            }

            const taskFolderPath = path.resolve(process.cwd(), taskFolder);
            const signatureFilePath = path.resolve(process.cwd(), signaturePath);

            await verifyTaskOrigin(taskFolderPath, signatureFilePath, commonName);
            break;
        }
        case 'tar': {
            if (!taskFolder) {
                console.error('Error: Missing required flags.');
                printUsage();
                process.exitCode = 1;
                return;
            }

            const taskFolderPath = path.resolve(process.cwd(), taskFolder);
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
