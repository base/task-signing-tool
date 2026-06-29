import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseArgs } from 'node:util';
import { quote as shellQuote } from 'shell-quote';
import { spawn as spawnProcess } from 'child_process';
import { promises as fs } from 'fs';
import { X509Certificate, createSign, createHash, createPrivateKey } from 'crypto';
import { MessageSignatureBundleBuilder, TSAWitness } from '@sigstore/sign';
import type { Signer, Signature } from '@sigstore/sign';
import { bundleToJSON } from '@sigstore/bundle';
import { pem as pemUtils } from '@sigstore/core';
import { HashAlgorithm } from '@sigstore/protobuf-specs';
import {
  buildAndValidateSignature,
  createDeterministicTarball,
  getURIPrefix,
} from '@/lib/task-origin-validate';
import { TASK_ORIGIN_SIGNATURE_FILE_NAMES, TASK_ORIGIN_COMMON_NAMES } from '@/lib/constants';
import trustedRoot from '@/lib/config/trusted-root.json';
import type { TaskOriginRole } from '@/lib/types';

const TSA_BASE_URL = 'https://timestamp.sigstore.dev';
const TSA_TIMESTAMP_PATH = '/api/v1/timestamp';

const CERT_PATH = path.join(os.homedir(), '.ottr');
const DEVICE_CERT = 'device-certificate.pem';
const DEVICE_CERT_KEY = 'device-certificate-key.pem';

const ECDSA_CURVE_TO_HASH: Record<
  string,
  { nodeDigest: string; sigstoreAlgorithm: HashAlgorithm }
> = {
  prime256v1: { nodeDigest: 'sha256', sigstoreAlgorithm: HashAlgorithm.SHA2_256 },
  secp384r1: { nodeDigest: 'sha384', sigstoreAlgorithm: HashAlgorithm.SHA2_384 },
  secp521r1: { nodeDigest: 'sha512', sigstoreAlgorithm: HashAlgorithm.SHA2_512 },
};

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
    verify-all Verify all three signatures (creator + both facilitators)
    tar          Create a deterministic tarball from a task folder

  Usage:
    tsx scripts/genTaskOriginSig.ts <command> --task-folder <PATH> [--signature-path <PATH>] [--facilitator <TYPE>] [--common-name <COMMON_NAME>] [--help]

  Required flags:
    --task-folder, -t    Folder containing the task to tar and sign

  Optional flags:
    --signature-path, -p Directory path to store/read the signature
    --facilitator, -f    Facilitator type: "base" or "security-council" (used for 'sign' and 'verify' commands, omit this flag to sign/verify as task creator)
    --common-name, -c    Common name for task creator (required when not using --facilitator in 'verify' and 'verify-all' commands)
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
      shell: true,
    });
    child.on('error', error => {
      reject(new Error(`Failed to execute command: ${error.message}`));
    });
    child.on('close', code => {
      resolve(code);
    });
  });
}

/**
 * Extracts the SAN URI from an X.509 certificate, e.g.
 * user:///email@coinbase.com or ldap:///base-facilitators.
 */
function parseURIFromCertificate(cert: X509Certificate): string {
  const san = cert.subjectAltName;
  if (!san) {
    throw new Error('No Subject Alternative Name found in certificate');
  }

  const uriMatch = san.match(/URI:((?:user|ldap):\/\/\/[^,\s]+)/);
  if (!uriMatch) {
    throw new Error(`Could not extract identity from SAN: ${san}`);
  }

  return uriMatch[1];
}

export function parseIdentityFromCertificate(cert: X509Certificate): string {
  return parseURIFromCertificate(cert).replace(/^(?:user|ldap):\/\/\//, '');
}

export async function generateDeviceCertificate(
  facilitator: FacilitatorType | undefined
): Promise<{ certPath: string; keyPath: string; identity: string }> {
  console.log('🔐 Generating device certificate...');

  const certCommand = [
    'ottr-cli',
    'generate',
    'device-certificate',
    '--environment',
    'production',
    '--region',
    'us-east-1',
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

  const command = shellQuote(certCommand);
  const code = await spawn(command);
  if (code !== 0) {
    throw new Error(`Device certificate generation failed with exit code ${code}`);
  }

  const certPath = path.join(CERT_PATH, DEVICE_CERT);
  const keyPath = path.join(CERT_PATH, DEVICE_CERT_KEY);

  // Identity returned from function must exclude user:/// scheme as the
  // existing verification logic for the Base Task Signer Tool UI uses
  // the raw email address within the `taskOriginConfig` JSON block.
  const certificate = new X509Certificate(await fs.readFile(certPath, 'utf8'));
  const identity = parseIdentityFromCertificate(certificate);
  console.log(`  Identity: ${identity}`);

  return { certPath, keyPath, identity };
}

const BEGIN_CERTIFICATE_PEM = '-----BEGIN CERTIFICATE-----';
const END_CERTIFICATE_PEM = '-----END CERTIFICATE-----';

export function parseCertificateChainPEM(pemData: string): Buffer[] {
  return pemData
    .split(END_CERTIFICATE_PEM)
    .filter(block => block.includes(BEGIN_CERTIFICATE_PEM))
    .map(block => pemUtils.toDER(block + END_CERTIFICATE_PEM));
}

export function resolveSignatureHash(keyPem: string): {
  nodeDigest: string;
  sigstoreAlgorithm: HashAlgorithm;
} {
  const namedCurve = createPrivateKey(keyPem).asymmetricKeyDetails?.namedCurve;
  const match = namedCurve ? ECDSA_CURVE_TO_HASH[namedCurve] : undefined;
  return match ?? ECDSA_CURVE_TO_HASH.prime256v1;
}

/**
 * Ensures the configured TSA endpoint matches a timestamp authority declared in
 * the trusted root used for verification. Signing against a TSA the trusted root
 * does not recognize produces timestamps that always fail verification, so we
 * fail fast if someone changes TSA_BASE_URL without updating the trusted root.
 */
export function assertTimestampAuthorityTrustedRoot(): void {
  const expectedURL = `${TSA_BASE_URL}${TSA_TIMESTAMP_PATH}`;
  const trustedURIs = (trustedRoot.timestampAuthorities ?? [])
    .map(tsa => tsa.uri)
    .filter((uri): uri is string => Boolean(uri));

  if (!trustedURIs.includes(expectedURL)) {
    throw new Error(
      `Configured TSA endpoint "${expectedURL}" does not match any timestamp authority ` +
        `in the trusted root (${trustedURIs.join(', ') || 'none'}). ` +
        `Update TSA_BASE_URL or the trusted root so they agree.`
    );
  }
}

class DeviceCertificateSigner implements Signer {
  constructor(
    private keyPem: string,
    private leafCertificatePem: string,
    private nodeDigest: string
  ) {}

  async sign(data: Buffer): Promise<Signature> {
    const signature = createSign(this.nodeDigest).update(new Uint8Array(data)).sign(this.keyPem);
    return {
      signature,
      key: { $case: 'x509Certificate', certificate: this.leafCertificatePem },
    };
  }
}

/**
 * Signs a task folder using an existing certificate.
 * Returns the signature file path, or undefined if signing fails.
 */
export async function signTaskWithCert(
  taskFolderPath: string,
  signatureDir: string,
  certPath: string,
  keyPath: string,
  role: TaskOriginRole
): Promise<string | undefined> {
  console.log('🔏 Signing task...');
  console.log(`  Task folder: ${taskFolderPath}`);

  const signatureFileName = TASK_ORIGIN_SIGNATURE_FILE_NAMES[role];
  const signatureFileOut = path.join(signatureDir, signatureFileName);

  const tarballPath = await createDeterministicTarball(taskFolderPath);
  console.log(`  Tarball: ${tarballPath}`);

  try {
    const keyPem = await fs.readFile(keyPath, 'utf8');
    const certificateChainPem = await fs.readFile(certPath, 'utf8');

    const certificateChain = parseCertificateChainPEM(certificateChainPem);
    if (certificateChain.length === 0) {
      console.error('  Error: No certificates found in certificate chain file');
      return undefined;
    }

    assertTimestampAuthorityTrustedRoot();

    const { nodeDigest, sigstoreAlgorithm } = resolveSignatureHash(keyPem);
    const bundler = new MessageSignatureBundleBuilder({
      signer: new DeviceCertificateSigner(
        keyPem,
        pemUtils.fromDER(certificateChain[0]),
        nodeDigest
      ),
      witnesses: [new TSAWitness({ tsaBaseURL: TSA_BASE_URL })],
    });

    const tarball = await fs.readFile(tarballPath);
    const bundle = await bundler.create({ data: tarball });

    if (bundle.content.$case === 'messageSignature') {
      bundle.content.messageSignature.messageDigest = {
        algorithm: sigstoreAlgorithm,
        digest: createHash(nodeDigest).update(new Uint8Array(tarball)).digest(),
      };
    }

    if (bundle.verificationMaterial.content.$case === 'x509CertificateChain') {
      bundle.verificationMaterial.content.x509CertificateChain.certificates = certificateChain.map(
        rawBytes => ({ rawBytes })
      );
    }

    const bundleJson = bundleToJSON(bundle);
    await fs.writeFile(signatureFileOut, JSON.stringify(bundleJson, null, 2));

    console.log(`  Signature: ${signatureFileOut}`);
    return signatureFileOut;
  } finally {
    await fs.rm(path.dirname(tarballPath), { recursive: true, force: true });
  }
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
 * Asserts that the certificate URI uses the scheme expected for the role
 * user:/// for Task Creators and ldap:/// for Facilitators.
 */
export async function assertURIPrefix(
  certificatePath: string,
  role: TaskOriginRole
): Promise<void> {
  const certificate = new X509Certificate(await fs.readFile(certificatePath, 'utf8'));
  const uri = parseURIFromCertificate(certificate);
  const expectedPrefix = getURIPrefix(role);
  if (!uri.startsWith(expectedPrefix)) {
    throw new Error(
      `Certificate URI "${uri}" does not use the expected "${expectedPrefix}" scheme for Task Origin Role "${role}".`
    );
  }
}

/**
 * Signs a task folder and returns the signature file path.
 * This generates a new device certificate and then signs.
 * Returns undefined if the signing fails.
 */
export async function signTask(
  taskFolderPath: string,
  signatureDir: string,
  facilitator: FacilitatorType | undefined
): Promise<string | undefined> {
  const role = facilitatorToRole(facilitator);

  if (facilitator) {
    console.log(`  Facilitator: ${facilitator}`);
    console.log(`  Group: ${facilitatorToGroup(facilitator)}`);
  } else {
    console.log(`  Role: Task Creator`);
  }

  try {
    const { certPath, keyPath } = await generateDeviceCertificate(facilitator);
    await assertURIPrefix(certPath, role);
    return await signTaskWithCert(taskFolderPath, signatureDir, certPath, keyPath, role);
  } catch (error) {
    console.error(`  Error: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
}

export async function verifyTaskOrigin(
  taskFolderPath: string,
  signatureDir: string,
  facilitator: FacilitatorType | undefined,
  commonName: string | undefined
) {
  console.log('✅ Validating task signature...');

  const role = facilitatorToRole(facilitator);
  const signatureFileName = TASK_ORIGIN_SIGNATURE_FILE_NAMES[role];
  const signatureFile = path.join(signatureDir, signatureFileName);

  let identity: string;
  if (facilitator) {
    identity =
      TASK_ORIGIN_COMMON_NAMES[
        role === 'baseFacilitator' ? 'baseFacilitator' : 'securityCouncilFacilitator'
      ];
    console.log(`  Facilitator: ${facilitator}`);
    console.log(`  Identity: ${identity}`);
  } else {
    if (!commonName) {
      console.error('  Error: --common-name is required when not using --facilitator');
      process.exitCode = 1;
      return;
    }
    identity = commonName;
    console.log(`  Identity: ${identity}`);
  }

  console.log(`  Signature File: ${signatureFile}`);

  try {
    await buildAndValidateSignature({
      taskFolderPath,
      signatureFile,
      commonName: identity,
      role,
    });
  } catch (error) {
    console.error(`❌ Verification failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
    return;
  }
}

export async function verifyAllSignatures(
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
  const allRoles: TaskOriginRole[] = [
    'taskCreator',
    'baseFacilitator',
    'securityCouncilFacilitator',
  ];

  for (const role of allRoles) {
    const roleName = roleDisplayNames[role];
    const signatureFileName = TASK_ORIGIN_SIGNATURE_FILE_NAMES[role];
    const signatureFile = path.join(signatureDir, signatureFileName);

    const identity =
      role === 'taskCreator' ? taskCreatorCommonName : TASK_ORIGIN_COMMON_NAMES[role];

    try {
      // Check if signature file exists
      await fs.access(signatureFile);

      // Validate the signature
      await buildAndValidateSignature({
        taskFolderPath,
        signatureFile,
        commonName: identity,
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
      facilitator: { type: 'string', short: 'f' },
      'common-name': { type: 'string', short: 'c' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    return;
  }

  const command = positionals[0] as 'sign' | 'verify' | 'verify-all' | 'tar' | undefined;
  // Validate command is provided
  if (!command) {
    console.error('Error: No command specified.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  // Validate command is recognized
  if (command !== 'sign' && command !== 'verify' && command !== 'verify-all' && command !== 'tar') {
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
      console.error(
        `Error: Invalid facilitator type '${facilitatorValue}'. Must be 'base' or 'security-council'.`
      );
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
    case 'verify-all': {
      // Require common-name for task creator verification
      if (!commonName) {
        console.error(
          'Error: --common-name is required for verify-all command (used for task creator validation).'
        );
        printUsage();
        process.exitCode = 1;
        return;
      }

      const signatureDir = signaturePath
        ? path.resolve(process.cwd(), signaturePath)
        : taskFolderPath;

      await verifyAllSignatures(taskFolderPath, signatureDir, commonName);
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
