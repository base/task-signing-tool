import * as tar from 'tar';
import path from 'path';
import fs from 'fs/promises';
import { Verifier, toTrustMaterial, toSignedEntity } from '@sigstore/verify';
import { bundleFromJSON } from '@sigstore/bundle';
import trustedRoot from './config/trusted-root.json';
import type { TaskOriginRole } from './types';
import { assertWithinDir } from './path-validation';

export type TaskOriginVerifyOptions = {
  taskFolderPath: string;
  signatureFile: string;
  commonName: string;
  role: TaskOriginRole;
  allowedDir?: string;
};

function getSubjectAlternativeNamePrefix(role: TaskOriginRole): string {
  // Task creators use user:/// prefix, facilitators use ldap:/// prefix
  return role === 'taskCreator' ? 'user:///' : 'ldap:///';
}

async function getAllFilesRecursively(
  dir: string,
  baseDir: string = dir,
  allowedDir?: string
): Promise<string[]> {
  // If an allowed directory is specified, resolve symlinks and validate the real path
  let currentDir = dir;
  if (allowedDir) {
    currentDir = await fs.realpath(dir);
    assertWithinDir(currentDir, allowedDir);
  }

  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];
  // Exclude cache, out, and signer-tool folders from the tarball
  const excludedFolders = ['cache', 'out', 'signer-tool'];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      // Skip excluded folders
      if (excludedFolders.includes(entry.name)) {
        continue;
      }
      files.push(...(await getAllFilesRecursively(fullPath, baseDir, allowedDir)));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath));
    }
  }

  return files;
}

export async function createDeterministicTarball(
  taskFolderPath: string,
  allowedDir?: string
): Promise<string> {
  // Validate the task folder path is within the allowed directory
  if (allowedDir) {
    assertWithinDir(taskFolderPath, allowedDir);
  }

  // Take the last '/' separate part of the folder path to be the tarfile name
  const folderName = taskFolderPath.split('/').pop();
  const tarballPath = path.resolve(process.cwd(), `${folderName}.tar`);

  // Check if lib/ folder exists for reproducibility
  const libPath = path.join(taskFolderPath, 'lib');
  if (allowedDir) {
    assertWithinDir(libPath, allowedDir);
  }
  try {
    const libStats = await fs.stat(libPath);
    if (!libStats.isDirectory()) {
      console.warn(
        '⚠️  Warning: lib/ exists but is not a directory. This may affect tarball reproducibility.'
      );
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      console.warn(
        '⚠️  Warning: lib/ folder not found. Tarball signatures may not match if dependencies are missing.'
      );
    }
  }

  // Get all files and sort them alphabetically for deterministic ordering
  const files = await getAllFilesRecursively(taskFolderPath, taskFolderPath, allowedDir);
  const sortedFiles = files.sort();

  await tar.create(
    {
      file: tarballPath,
      portable: true,
      mtime: new Date(0),
      strict: true,
      cwd: taskFolderPath,
    },
    sortedFiles
  );

  return tarballPath;
}

export async function buildAndValidateSignature(options: TaskOriginVerifyOptions): Promise<void> {
  const { taskFolderPath, signatureFile, commonName, role, allowedDir } = options;
  console.log(`  Task folder: ${taskFolderPath}`);

  // Validate paths are within the allowed directory if specified
  if (allowedDir) {
    assertWithinDir(taskFolderPath, allowedDir);
    assertWithinDir(signatureFile, allowedDir);
  }

  // Extract the bundle containing both the signature and certificate chain
  console.log(`  Signature: ${signatureFile}`);
  const bundleSigJSON = JSON.parse(await fs.readFile(signatureFile, 'utf8'));
  const bundleSig = bundleFromJSON(bundleSigJSON);

  // Regenerate the tarball from the provided task folder
  const tarballPath = await createDeterministicTarball(taskFolderPath, allowedDir);
  const tarball = await fs.readFile(tarballPath); // Read as binary Buffer

  // Extract the deployment-specific intermediate CA from bundle
  // Bundle structure: [0]=leaf, [1]=runtime intermediate, [2]=static intermediate, [3]=root
  // Trusted root has: [static intermediate, root]
  // We need to inject [1] (runtime intermediate) to build the complete chain
  const bundleCerts =
    bundleSig.verificationMaterial?.content?.$case === 'x509CertificateChain'
      ? bundleSig.verificationMaterial.content.x509CertificateChain.certificates
      : [];

  // Extract the runtime intermediate (cert [1]) and root (cert [3]) - keep as Buffers
  const runtimeIntermediate = bundleCerts[1] ? { rawBytes: bundleCerts[1].rawBytes } : null;
  const rootCert = bundleCerts[3] ? { rawBytes: bundleCerts[3].rawBytes } : null;

  // Prepare trust material with:
  // 1. Date strings converted to Date objects (required for filtering)
  // 2. Runtime intermediate CA injected into certificate chain
  const normalizedTrustedRoot = {
    ...trustedRoot,
    tlogs: trustedRoot.tlogs || [],
    ctlogs: trustedRoot.ctlogs || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    certificateAuthorities: trustedRoot.certificateAuthorities?.map((ca: any) => {
      // Convert base64 strings to Buffers for all certificates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseCerts = ca.certChain.certificates.map((cert: any) => ({
        rawBytes: Buffer.from(cert.rawBytes, 'base64'),
      }));

      // Build the certificate chain: base certs + runtime intermediate + root
      const certChain = [...baseCerts];
      if (runtimeIntermediate) certChain.push(runtimeIntermediate);
      if (rootCert) certChain.push(rootCert);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    timestampAuthorities: trustedRoot.timestampAuthorities?.map((tsa: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized: any = {
        subject: tsa.subject,
        uri: tsa.uri,
        certChain: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          certificates: tsa.certChain.certificates.map((cert: any) => ({
            rawBytes: Buffer.from(cert.rawBytes, 'base64'),
          })),
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
    tsaThreshold: 1, // Require TSA timestamp verification
    ctlogThreshold: 0, // No CT logs for custom CA
    tlogThreshold: 0, // No transparency logs for custom CA
  };

  // Create the verifier with custom trust material
  const verifier = new Verifier(trustMaterial, verifierOptions);

  // Convert bundle to signed entity for verification
  const signedEntity = toSignedEntity(bundleSig, tarball); // tarball is already a Buffer

  // Build SAN with appropriate prefix based on role
  const sanPrefix = getSubjectAlternativeNamePrefix(role);
  const subjectAlternativeName = `${sanPrefix}${commonName}`;

  // Define the verification policy with the created subject alternative name
  const verificationPolicy = {
    subjectAlternativeName,
  };

  // Verify the signature
  try {
    console.log('  Performing verification...');
    verifier.verify(signedEntity, verificationPolicy);
    console.log('✅ Verification successful!');
  } catch (error: unknown) {
    console.error('  Error details:', error);
    throw new Error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function verifyTaskOrigin(options: TaskOriginVerifyOptions): Promise<void> {
  // Make sure that the task folder path and signature file exist
  const { taskFolderPath, signatureFile, commonName, role, allowedDir } = options;
  if (!taskFolderPath || !signatureFile || !commonName || !role) {
    throw new Error('Task folder path, signature file, commonName, and role are required');
  }

  // Validate paths are within the allowed directory if specified
  if (allowedDir) {
    assertWithinDir(taskFolderPath, allowedDir);
    assertWithinDir(signatureFile, allowedDir);
  }

  // Make sure that the task folder path and signature file exist
  try {
    const taskStats = await fs.stat(taskFolderPath);
    if (!taskStats.isDirectory()) {
      throw new Error(`Task folder path exists but is not a directory: ${taskFolderPath}`);
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Task folder path does not exist: ${taskFolderPath}`);
    }
    throw error;
  }

  try {
    const sigStats = await fs.stat(signatureFile);
    if (!sigStats.isFile()) {
      throw new Error(`Signature path exists but is not a file: ${signatureFile}`);
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Signature file does not exist: ${signatureFile}`);
    }
    throw error;
  }

  // Build and validate the signature
  try {
    await buildAndValidateSignature(options);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    throw error;
  }
}
