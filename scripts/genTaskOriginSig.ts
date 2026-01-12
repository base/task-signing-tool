import * as tar from 'tar';
import path from 'path';
import fs from 'fs/promises';
import { parseArgs } from 'node:util';
import { parse as shellParse, quote as shellQuote } from 'shell-quote';
import { spawn as spawnProcess } from 'child_process';
import { bundleFromJSON } from '@sigstore/bundle';
import { Verifier, toTrustMaterial, toSignedEntity } from '@sigstore/verify';

function printUsage(): void {
    const msg = `
  Generate a task origin signature from a bundle.

  Commands:
    sign       Generate a signature for a task
    verify     Verify a signature for a task

  Usage:
    tsx scripts/genTaskOriginSig.ts <command> --task-folder <PATH> --signature-path <PATH> [--trusted-root <PATH>] [--signature-file <PATH>] [--email <EMAIL>] [--help]

  Optional flags:
    --task-folder, -t    Folder containing the task to tar and sign
    --signature-path, -s Path to store the signature output
    --trusted-root, -r   Trusted root to use for verification
    --signature-file, -f Signature file to use for verification
    --email, -e          Email to use for verification
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

async function getAllFilesRecursively(dir: string, baseDir: string = dir): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await getAllFilesRecursively(fullPath, baseDir));
        } else if (entry.isFile()) {
            // Get relative path from base directory
            files.push(path.relative(baseDir, fullPath));
        }
    }

    return files;
}

async function createDeterministicTarball(taskFolderPath: string): Promise<string> {
    // Take the last '/' separate part of the folder path to be the tarfile name
    const folderName = taskFolderPath.split('/').pop();
    const tarballPath = path.resolve(process.cwd(), `${folderName}.tar`);

    // Get all files and sort them alphabetically for deterministic ordering
    const files = await getAllFilesRecursively(taskFolderPath);
    const sortedFiles = files.sort();

    await tar.create({
        file: tarballPath,
        portable: true,
        mtime: new Date(0),
        strict: true,
        cwd: taskFolderPath,
    }, sortedFiles);

    return tarballPath;
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

async function verifyTaskOrigin(taskFolderPath: string, signatureFile: string, trustedRootPath: string, email: string) {
    console.log('✅ Validating task signature...');
    console.log(`  Task folder: ${taskFolderPath}`);

    // Extract the bundle containing both the signature and certificate chain
    console.log(`  Signature: ${signatureFile}`);
    const bundleSigJSON = JSON.parse(await fs.readFile(signatureFile, 'utf8'));
    const bundleSig = bundleFromJSON(bundleSigJSON);

    // Regenerate the tarball from the provided task folder
    // TODO: At some point we will need to check that the signatures are not being signed against non-determinsitic tarballs, which a checksum would be good for
    const tarballPath = await createDeterministicTarball(taskFolderPath);
    const tarball = await fs.readFile(tarballPath); // Read as binary Buffer

    // Load the trusted root which contains the certificate chain
    console.log(`  Trusted root: ${trustedRootPath}`);
    const trustedRoot = JSON.parse(await fs.readFile(trustedRootPath, 'utf8'));

    // Extract the deployment-specific intermediate CA from bundle
    // Bundle structure: [0]=leaf, [1]=runtime intermediate, [2]=static intermediate, [3]=root
    // Trusted root has: [static intermediate, root]
    // We need to inject [1] (runtime intermediate) to build the complete chain
    const bundleCerts = bundleSig.verificationMaterial?.content?.$case === 'x509CertificateChain'
        ? bundleSig.verificationMaterial.content.x509CertificateChain.certificates
        : [];

    // Extract the runtime intermediate (cert [1]) and root (cert [3]) - keep as Buffers
    const runtimeIntermediate = bundleCerts[1]
        ? { rawBytes: bundleCerts[1].rawBytes }
        : null;
    const rootCert = bundleCerts[3]
        ? { rawBytes: bundleCerts[3].rawBytes }
        : null;

    if (runtimeIntermediate) {
        console.log('  ✓ Extracted runtime intermediate CA from bundle');
    }

    // Prepare trust material with:
    // 1. Date strings converted to Date objects (required for filtering)
    // 2. Runtime intermediate CA injected into certificate chain
    const normalizedTrustedRoot = {
        ...trustedRoot,
        tlogs: trustedRoot.tlogs || [],
        ctlogs: trustedRoot.ctlogs || [],
        certificateAuthorities: trustedRoot.certificateAuthorities?.map((ca: any) => {
            // Convert base64 strings to Buffers for all certificates
            const baseCerts = ca.certChain.certificates.map((cert: any) => ({
                rawBytes: Buffer.from(cert.rawBytes, 'base64')
            }));

            // Build the certificate chain: base certs + runtime intermediate + root
            const certChain = [...baseCerts];
            if (runtimeIntermediate) certChain.push(runtimeIntermediate);
            if (rootCert) certChain.push(rootCert);

            const normalized: any = {
                subject: ca.subject,
                certChain: {
                    certificates: certChain,
                },
                validFor: {
                    start: ca.validFor?.start ? new Date(ca.validFor.start) : undefined,
                    end: ca.validFor?.end ? new Date(ca.validFor.end) : undefined,
                },
            };
            if (ca.uri) normalized.uri = ca.uri;
            return normalized;
        }),
        timestampAuthorities: trustedRoot.timestampAuthorities?.map((tsa: any) => {
            const normalized: any = {
                subject: tsa.subject,
                uri: tsa.uri,
                certChain: {
                    certificates: tsa.certChain.certificates.map((cert: any) => ({
                        rawBytes: Buffer.from(cert.rawBytes, 'base64')
                    }))
                },
                validFor: {
                    start: tsa.validFor?.start ? new Date(tsa.validFor.start) : undefined,
                    end: tsa.validFor?.end ? new Date(tsa.validFor.end) : undefined,
                },
            };
            return normalized;
        }),
    };

    // Create trust material from the custom trusted root
    const trustMaterial = toTrustMaterial(normalizedTrustedRoot);

    // Configure verifier options
    const verifierOptions = {
        tsaThreshold: 1,      // Require TSA timestamp verification
        ctlogThreshold: 0,    // No CT logs for custom CA
        tlogThreshold: 0,     // No transparency logs for custom CA
    };

    // Create the verifier with custom trust material
    const verifier = new Verifier(trustMaterial, verifierOptions);

    // Convert bundle to signed entity for verification
    const signedEntity = toSignedEntity(bundleSig, tarball); // tarball is already a Buffer

    // Define the verification policy - verify certificate identity
    const certificateIdentityOptions = {
        subjectAlternativeName: `user:///${email}`,
        extensions: {}, // Required by runtime even though TypeScript types mark it optional
    };

    // Verify the signature
    try {
        console.log('  Performing verification...');
        // Note: TypeScript types are incomplete - the runtime API actually expects
        // certificateIdentityVerifiers array, not just a single CertificateIdentity
        verifier.verify(signedEntity, {
            certificateIdentityVerifiers: [certificateIdentityOptions],
        } as any);
        console.log('✅ Verification successful!');
    } catch (error: any) {
        console.error('  Error details:', error);
        throw new Error(`Validation failed: ${error.message}`);
    }
}

async function main() {
    const { values, positionals } = parseArgs({
        args: process.argv.slice(2),
        options: {
            'task-folder': { type: 'string', short: 't' },
            'signature-path': { type: 'string', short: 's' },
            'trusted-root': { type: 'string', short: 'r' },
            'signature-file': { type: 'string', short: 'f' },
            'email': { type: 'string', short: 'e' },
            help: { type: 'boolean', short: 'h' },
        },
        allowPositionals: true,
    });

    if (values.help) {
        printUsage();
        return;
    }

    const command = positionals[0] as 'sign' | 'verify' | undefined;
    // Validate command is provided
    if (!command) {
        console.error('Error: No command specified.');
        printUsage();
        process.exitCode = 1;
        return;
    }

    // Validate command is recognized
    if (command !== 'sign' && command !== 'verify') {
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
    const trustedRoot = values['trusted-root'];
    const signatureFile = values['signature-file'];
    const email = values['email'];

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
            if (!taskFolder || !trustedRoot || !signatureFile || !email) {
                console.error('Error: Missing required flags.');
                printUsage();
                process.exitCode = 1;
                return;
            }

            const taskFolderPath = path.resolve(process.cwd(), taskFolder);
            const signatureFilePath = path.resolve(process.cwd(), signatureFile);
            const trustedRootPath = path.resolve(process.cwd(), trustedRoot);

            await verifyTaskOrigin(taskFolderPath, signatureFilePath, trustedRootPath, email);
            break;
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
});
