import os from 'os';
import path from 'path';
import { readFileSync, writeFileSync, promises as fsp } from 'fs';
import { X509Certificate, generateKeyPairSync, createHash } from 'crypto';
import { fileURLToPath } from 'url';
import forge from 'node-forge';
import { HashAlgorithm } from '@sigstore/protobuf-specs';
import { TSAWitness } from '@sigstore/sign';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  verifyTaskOrigin,
  verifyAllSignatures,
  signTaskWithCert,
  assertURIPrefix,
  assertTimestampAuthorityTrustedRoot,
  parseIdentityFromCertificate,
  parseCertificateChainPEM,
  resolveSignatureHash,
  FacilitatorType,
} from '../scripts/genTaskOriginSig';
import { createDeterministicTarball } from '../src/lib/task-origin-validate';

// Fixture paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const VALID_TASK_FOLDER = path.join(FIXTURES_DIR, 'valid-task');
const VALID_SIGNATURES_DIR = path.join(FIXTURES_DIR, 'signatures/valid');
const INVALID_SIGNATURES_DIR = path.join(FIXTURES_DIR, 'signatures/invalid');
const MISSING_SIGNATURES_DIR = path.join(FIXTURES_DIR, 'signatures/missing');

// Task creator email
const TASK_CREATOR_EMAIL = 'alexis.williams.1@coinbase.com';
const WRONG_TASK_CREATOR_EMAIL = 'test@test.com';

describe('parseIdentityFromCertificate', () => {
  it('strips the user:/// scheme, returning the bare email for a task creator certificate', () => {
    const certificate = parseEndEntityCertificate(
      path.join(VALID_SIGNATURES_DIR, 'creator-signature.json')
    );
    const identity = parseIdentityFromCertificate(certificate);

    expect(identity).toBe(TASK_CREATOR_EMAIL); // 'alexis.williams.1@coinbase.com'
    expect(identity).not.toMatch(/^(?:user|ldap):\/\/\//);
  });

  it('strips the ldap:/// scheme, returning the bare group for a base facilitator certificate', () => {
    const certificate = parseEndEntityCertificate(
      path.join(VALID_SIGNATURES_DIR, 'base-facilitator-signature.json')
    );
    const identity = parseIdentityFromCertificate(certificate);

    expect(identity).toBe('base-facilitators');
    expect(identity).not.toMatch(/^(?:user|ldap):\/\/\//);
  });

  it('strips the ldap:/// scheme for a security council facilitator certificate', () => {
    const certificate = parseEndEntityCertificate(
      path.join(VALID_SIGNATURES_DIR, 'base-sc-facilitator-signature.json')
    );
    const identity = parseIdentityFromCertificate(certificate);

    expect(identity).toBe('base-sc-facilitators');
    expect(identity).not.toMatch(/^(?:user|ldap):\/\/\//);
  });
});

describe('resolveSignatureHash', () => {
  const ecPrivateKeyPem = (namedCurve: string): string =>
    generateKeyPairSync('ec', { namedCurve }).privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }) as string;

  it.each<[string, string, HashAlgorithm]>([
    ['prime256v1', 'sha256', HashAlgorithm.SHA2_256],
    ['secp384r1', 'sha384', HashAlgorithm.SHA2_384],
    ['secp521r1', 'sha512', HashAlgorithm.SHA2_512],
  ])('maps EC curve %s to %s', (curve, nodeDigest, sigstoreAlgorithm) => {
    const result = resolveSignatureHash(ecPrivateKeyPem(curve));
    expect(result.nodeDigest).toBe(nodeDigest);
    expect(result.sigstoreAlgorithm).toBe(sigstoreAlgorithm);
  });

  it('defaults to sha256 for a non-EC (RSA) key', () => {
    const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }) as string;
    const result = resolveSignatureHash(pem);
    expect(result.nodeDigest).toBe('sha256');
    expect(result.sigstoreAlgorithm).toBe(HashAlgorithm.SHA2_256);
  });
});

describe('parseCertificateChainPEM', () => {
  it('parses every certificate in a full certificate chain', () => {
    const { pem, rawBytesBase64 } = certificateChainFromBundle(
      path.join(VALID_SIGNATURES_DIR, 'creator-signature.json')
    );

    const ders = parseCertificateChainPEM(pem);

    expect(ders).toHaveLength(4);
    expect(ders.map(der => der.toString('base64'))).toEqual(rawBytesBase64);
  });

  it('returns an empty array when there are no certificates', () => {
    expect(parseCertificateChainPEM('invalid')).toHaveLength(0);
  });
});

describe('verifyTaskOrigin', () => {
  let originalExitCode: number | undefined;

  beforeEach(() => {
    originalExitCode = process.exitCode as number | undefined;
    process.exitCode = undefined;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
  });

  describe('valid signatures', () => {
    it('validates a valid task creator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        VALID_SIGNATURES_DIR,
        undefined, // no facilitator = task creator
        TASK_CREATOR_EMAIL
      );

      expect(process.exitCode).toBeUndefined();
    });

    it('validates a valid base facilitator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        VALID_SIGNATURES_DIR,
        'base' as FacilitatorType,
        undefined // common name derived from facilitator type
      );

      expect(process.exitCode).toBeUndefined();
    });

    it('validates a valid security council facilitator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        VALID_SIGNATURES_DIR,
        'security-council' as FacilitatorType,
        undefined // common name derived from facilitator type
      );

      expect(process.exitCode).toBeUndefined();
    });
  });

  describe('invalid signatures', () => {
    it('fails validation with an invalid task creator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        INVALID_SIGNATURES_DIR,
        undefined,
        TASK_CREATOR_EMAIL
      );

      expect(process.exitCode).toBe(1);
    });

    it('fails validation with an invalid base facilitator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        INVALID_SIGNATURES_DIR,
        'base' as FacilitatorType,
        undefined
      );

      expect(process.exitCode).toBe(1);
    });

    it('fails validation with an invalid security council facilitator signature', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        INVALID_SIGNATURES_DIR,
        'security-council' as FacilitatorType,
        undefined
      );

      expect(process.exitCode).toBe(1);
    });
  });

  describe('missing common name', () => {
    it('sets exitCode to 1 when common-name is missing for task creator', async () => {
      await verifyTaskOrigin(
        VALID_TASK_FOLDER,
        VALID_SIGNATURES_DIR,
        undefined, // no facilitator
        undefined // no common name
      );

      expect(process.exitCode).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('--common-name is required')
      );
    });
  });
});

describe('verifyAllSignatures', () => {
  let originalExitCode: number | undefined;

  beforeEach(() => {
    originalExitCode = process.exitCode as number | undefined;
    process.exitCode = undefined;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    jest.restoreAllMocks();
  });

  it('validates successfully when all 3 signatures are valid', async () => {
    await verifyAllSignatures(VALID_TASK_FOLDER, VALID_SIGNATURES_DIR, TASK_CREATOR_EMAIL);

    expect(process.exitCode).toBeUndefined();
  });

  it('fails validation when one or more signatures are missing', async () => {
    await verifyAllSignatures(VALID_TASK_FOLDER, MISSING_SIGNATURES_DIR, TASK_CREATOR_EMAIL);

    expect(process.exitCode).toBe(1);
  });

  it('fails validation when all signatures are invalid', async () => {
    await verifyAllSignatures(VALID_TASK_FOLDER, INVALID_SIGNATURES_DIR, TASK_CREATOR_EMAIL);

    expect(process.exitCode).toBe(1);
  });

  it('fails validation with wrong common name for task creator', async () => {
    await verifyAllSignatures(VALID_TASK_FOLDER, VALID_SIGNATURES_DIR, WRONG_TASK_CREATOR_EMAIL);

    expect(process.exitCode).toBe(1);
  });
});

describe('signTaskWithCert', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'sign-task-'));
    jest.spyOn(TSAWitness.prototype, 'testify').mockResolvedValue({ rfc3161Timestamps: [] });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await fsp.rm(directory, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('generate sigstore v0.2 bundle', async () => {
    const { keyPath, certPath } = generateSelfSignedCertificate(
      directory,
      'user:///test@example.com'
    );
    const taskFolder = path.join(directory, 'task');
    await fsp.mkdir(path.join(taskFolder, 'lib'), { recursive: true });
    await fsp.writeFile(path.join(taskFolder, 'task.json'), '{}');
    const signatureDir = path.join(directory, 'signatures');
    await fsp.mkdir(signatureDir);

    const signatureFile = await signTaskWithCert(
      taskFolder,
      signatureDir,
      certPath,
      keyPath,
      'taskCreator'
    );

    expect(signatureFile).toBeDefined();
    const bundle = JSON.parse(await fsp.readFile(signatureFile!, 'utf8'));

    // Expect Sigstore Bundle v0.2
    expect(bundle.mediaType).toBe('application/vnd.dev.sigstore.bundle+json;version=0.2');
    expect(bundle.messageSignature.signature).toBeTruthy();

    expect(bundle.messageSignature.messageDigest.algorithm).toBe('SHA2_256'); // RSA key -> SHA-256
    expect(bundle.verificationMaterial.x509CertificateChain.certificates[0].rawBytes).toBeTruthy();

    const tarballPath = await createDeterministicTarball(taskFolder);
    const tarball = await fsp.readFile(tarballPath);
    const expectedDigest = createHash('sha256').update(new Uint8Array(tarball)).digest('base64');
    expect(bundle.messageSignature.messageDigest.digest).toBe(expectedDigest);
  });
});

describe('assertURIPrefix', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'assert-uri-'));
  });

  afterEach(async () => {
    await fsp.rm(directory, { recursive: true, force: true });
  });

  it('successfully asserts user:/// URI prefix for task creator', async () => {
    const certPath = await writeFixtureLeafCertificate(
      path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
      directory
    );
    await expect(assertURIPrefix(certPath, 'taskCreator')).resolves.toBeUndefined();
  });

  it('fails to assert user:/// URI prefix for facilitator role', async () => {
    const certPath = await writeFixtureLeafCertificate(
      path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
      directory
    );
    await expect(assertURIPrefix(certPath, 'baseFacilitator')).rejects.toThrow();
  });

  it('successfully asserts ldap:/// URI prefix for base facilitator', async () => {
    const certPath = await writeFixtureLeafCertificate(
      path.join(VALID_SIGNATURES_DIR, 'base-facilitator-signature.json'),
      directory
    );
    await expect(assertURIPrefix(certPath, 'baseFacilitator')).resolves.toBeUndefined();
  });

  it('fails to assert certificate has no user:/// or ldap:/// URI prefix', async () => {
    const { certPath } = generateSelfSignedCertificate(directory);
    await expect(assertURIPrefix(certPath, 'taskCreator')).rejects.toThrow();
  });
});

describe('assertTimestampAuthorityTrustedRoot', () => {
  it('does not throw when the configured TSA matches the bundled trusted root', () => {
    expect(() => assertTimestampAuthorityTrustedRoot()).not.toThrow();
  });
});

function parseEndEntityCertificate(bundlePath: string): X509Certificate {
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  const rawBytes = bundle.verificationMaterial.x509CertificateChain.certificates[0].rawBytes;
  return new X509Certificate(new Uint8Array(Buffer.from(rawBytes, 'base64')));
}

// Self-Signed Certificate generated with RSA Key Pair, the default behavior
// is to sign using a ECDSA P-384 Key but it is not supported with node-forge.
function generateSelfSignedCertificate(
  directory: string,
  sanUri?: string
): { keyPath: string; certPath: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const subject = [{ name: 'commonName', value: 'test-signer' }];
  cert.setSubject(subject);
  cert.setIssuer(subject); // Self-Signed
  cert.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true },
    {
      name: 'subjectAltName',
      altNames: [sanUri ? { type: 6, value: sanUri } : { type: 2, value: 'test-signer' }],
    },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const keyPath = path.join(directory, 'key.pem');
  const certPath = path.join(directory, 'certificate.pem');
  writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey));
  writeFileSync(certPath, forge.pki.certificateToPem(cert));

  return { keyPath, certPath };
}

async function writeFixtureLeafCertificate(bundlePath: string, directory: string): Promise<string> {
  const certificatePath = path.join(directory, 'leaf.pem');
  await fsp.writeFile(certificatePath, parseEndEntityCertificate(bundlePath).toString());
  return certificatePath;
}


// Returns the full certificate chain from a Sigstore bundle as a PEM string,
// alongside the original per-certificate DER (base64).
function certificateChainFromBundle(bundlePath: string): {
  pem: string;
  rawBytesBase64: string[];
} {
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  const certificates = bundle.verificationMaterial.x509CertificateChain.certificates as {
    rawBytes: string;
  }[];
  const rawBytesBase64 = certificates.map(c => c.rawBytes);
  const pem = certificates
    .map(c => new X509Certificate(new Uint8Array(Buffer.from(c.rawBytes, 'base64'))).toString())
    .join('');
  return { pem, rawBytesBase64 };
}
