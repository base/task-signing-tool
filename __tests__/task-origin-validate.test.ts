import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs/promises';
import crypto from 'crypto';
import forge from 'node-forge';
import * as tar from 'tar';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  createDeterministicTarball,
  buildAndValidateSignature,
} from '../src/lib/task-origin-validate';
import type { TaskOriginRole } from '../src/lib/types';

// Fixture paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
// The tarball is scoped to a single network config dir; cache/ and out/ build
// artifacts live at the task root, outside this leaf, so they are never signed.
const VALID_TASK_FOLDER = path.join(FIXTURES_DIR, 'valid-task', 'config', 'chain1');
const MODIFIED_TASK_FOLDER = path.join(FIXTURES_DIR, 'modified-task', 'config', 'chain1');
const VALID_SIGNATURES_DIR = path.join(FIXTURES_DIR, 'signatures/valid');

// Task creator email
const TASK_CREATOR_EMAIL = 'alexis.williams.1@coinbase.com';
const WRONG_TASK_CREATOR_EMAIL = 'test@test.com';

async function computeFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(new Uint8Array(content)).digest('hex');
}

async function listTarEntries(tarballPath: string): Promise<string[]> {
  const entries: string[] = [];
  await tar.list({
    file: tarballPath,
    onReadEntry: entry => {
      entries.push(entry.path);
    },
  });
  return entries;
}

describe('createDeterministicTarball', () => {
  let tempDir: string;
  let createdTarballs: string[] = [];

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tarball-test-'));
    createdTarballs = [];
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });

    // Clean up any created tarballs
    for (const tarball of createdTarballs) {
      try {
        await fs.unlink(tarball);
      } catch {
        // Ignore errors if file doesn't exist
      }
    }

    jest.restoreAllMocks();
  });

  it('produces a valid tarball', async () => {
    // Create a simple file structure
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'test content');

    const tarballPath = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarballPath);

    // Verify tarball exists and has content
    const stats = await fs.stat(tarballPath);
    expect(stats.size).toBeGreaterThan(0);

    // Verify it's a valid tar by listing entries
    const entries = await listTarEntries(tarballPath);
    expect(entries).toContain('test.txt');
  });

  it('produces deterministic output with identical hash', async () => {
    // Create some files
    await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content 1');
    await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content 2');
    await fs.mkdir(path.join(tempDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'subdir', 'file3.txt'), 'content 3');

    // Create first tarball and compute hash
    const tarball1 = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarball1);
    const hash1 = await computeFileHash(tarball1);

    // Delete the tarball
    await fs.unlink(tarball1);
    createdTarballs = createdTarballs.filter(t => t !== tarball1);

    // Create second tarball and compute hash
    const tarball2 = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarball2);
    const hash2 = await computeFileHash(tarball2);

    // Hashes should be identical
    expect(hash1).toBe(hash2);
  });

  it('sorts files alphabetically in the tarball', async () => {
    // Create files and folders out of alphabetical order
    await fs.mkdir(path.join(tempDir, 'zebra'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'apple'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'zebra', 'file.txt'), 'zebra data');
    await fs.writeFile(path.join(tempDir, 'apple', 'file.txt'), 'apple data');
    await fs.writeFile(path.join(tempDir, 'middle.txt'), 'middle data');
    await fs.writeFile(path.join(tempDir, 'aaa.txt'), 'aaa data');
    await fs.writeFile(path.join(tempDir, 'zzz.txt'), 'zzz data');

    const tarballPath = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarballPath);

    const entries = await listTarEntries(tarballPath);

    // Verify entries are in alphabetical order
    const sortedEntries = [...entries].sort();
    expect(entries).toEqual(sortedEntries);
  });

  it('includes nested directories', async () => {
    // Create nested structure
    await fs.mkdir(path.join(tempDir, 'level1', 'level2', 'level3'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'level1', 'l1.txt'), 'level 1');
    await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'l2.txt'), 'level 2');
    await fs.writeFile(path.join(tempDir, 'level1', 'level2', 'level3', 'l3.txt'), 'level 3');

    const tarballPath = await createDeterministicTarball(tempDir);
    createdTarballs.push(tarballPath);

    const entries = await listTarEntries(tarballPath);

    expect(entries).toContain('level1/l1.txt');
    expect(entries).toContain('level1/level2/l2.txt');
    expect(entries).toContain('level1/level2/level3/l3.txt');
  });
});

describe('buildAndValidateSignature', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('valid signatures', () => {
    it('validates a valid signature with matching tarball', async () => {
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName: TASK_CREATOR_EMAIL,
          role: 'taskCreator' as TaskOriginRole,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('tarball mismatch', () => {
    it('fails validation when signature does not match tarball content', async () => {
      // Use valid signature but with modified task folder
      await expect(
        buildAndValidateSignature({
          taskFolderPath: MODIFIED_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName: TASK_CREATOR_EMAIL,
          role: 'taskCreator' as TaskOriginRole,
        })
      ).rejects.toThrow();
    });
  });

  describe('SAN mismatch', () => {
    it('fails validation with wrong email for task creator', async () => {
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName: WRONG_TASK_CREATOR_EMAIL,
          role: 'taskCreator' as TaskOriginRole,
        })
      ).rejects.toThrow();
    });

    it('fails validation with a common name that is a prefix of the real identity', async () => {
      const commonName = TASK_CREATOR_EMAIL.replace(/\.com$/, ''); // alexis.williams.1@coinbase
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName,
          role: 'taskCreator' as TaskOriginRole,
        })
      ).rejects.toThrow(
        `Verification failed: certificate identity error, expected user:///${commonName} but received user:///${TASK_CREATOR_EMAIL}`
      );
    });

    it('fails validation with a common name that uses a regex wildcard', async () => {
      const commonName = TASK_CREATOR_EMAIL.replace('.1@', '..@'); // alexis.williams..@coinbase.com
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName,
          role: 'taskCreator' as TaskOriginRole,
        })
      ).rejects.toThrow(
        `Verification failed: certificate identity error, expected user:///${commonName} but received user:///${TASK_CREATOR_EMAIL}`
      );
    });

    it('fails validation when task creator signature is verified as facilitator role', async () => {
      // Try to verify a task creator signature with facilitator role
      // This should fail because SAN prefix is user:/// but we expect ldap:///
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'creator-signature.json'),
          commonName: TASK_CREATOR_EMAIL,
          role: 'baseFacilitator' as TaskOriginRole,
        })
      ).rejects.toThrow();
    });

    it('fails validation when facilitator signature is verified as task creator role', async () => {
      // Try to verify a facilitator signature with task creator role
      // This should fail because SAN prefix is ldap:/// but we expect user:///
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: path.join(VALID_SIGNATURES_DIR, 'base-facilitator-signature.json'),
          commonName: 'base-facilitators',
          role: 'taskCreator' as TaskOriginRole,
        })
      ).rejects.toThrow();
    });
  });

  describe('self-minted certificate chain', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forged-sig-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true });
    });

    // Mints a completely self-signed chain (attacker's own root -> intermediate ->
    // leaf) that never touches the real Coinbase hierarchy. The subject/issuer names
    // mirror the genuine chain so that, absent the pins, it would build a valid path.
    function mintSelfSignedChain(sanURI: string): {
      leaf: string;
      intermediate: string;
      root: string;
    } {
      const notBefore = new Date('2020-01-01T00:00:00Z');
      const notAfter = new Date('2050-01-01T00:00:00Z');

      const derBase64 = (cert: forge.pki.Certificate): string =>
        forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());

      const makeCert = (
        subjectCN: string,
        issuerCN: string,
        subjectKey: forge.pki.rsa.PublicKey,
        signingKey: forge.pki.rsa.PrivateKey,
        serial: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extensions: any[]
      ): forge.pki.Certificate => {
        const cert = forge.pki.createCertificate();
        cert.publicKey = subjectKey;
        cert.serialNumber = serial;
        cert.validity.notBefore = notBefore;
        cert.validity.notAfter = notAfter;
        cert.setSubject([{ name: 'commonName', value: subjectCN }]);
        cert.setIssuer([{ name: 'commonName', value: issuerCN }]);
        cert.setExtensions(extensions);
        cert.sign(signingKey, forge.md.sha256.create());
        return cert;
      };

      const rootKeys = forge.pki.rsa.generateKeyPair(2048);
      const intKeys = forge.pki.rsa.generateKeyPair(2048);
      const leafKeys = forge.pki.rsa.generateKeyPair(2048);

      // Self-signed root impersonating the real CB-ROOT-CORE.
      const root = makeCert(
        'CB-ROOT-CORE',
        'CB-ROOT-CORE',
        rootKeys.publicKey,
        rootKeys.privateKey,
        '01',
        [
          { name: 'basicConstraints', cA: true, critical: true },
          { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
        ]
      );
      // Intermediate impersonating the runtime intermediate, signed by the fake root.
      const intermediate = makeCert(
        'corporate.device.cbhq.net',
        'CB-ROOT-CORE',
        intKeys.publicKey,
        rootKeys.privateKey,
        '02',
        [
          { name: 'basicConstraints', cA: true, critical: true },
          { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
        ]
      );
      // Leaf carrying a forged facilitator identity, signed by the fake intermediate.
      const leaf = makeCert(
        'forged',
        'corporate.device.cbhq.net',
        leafKeys.publicKey,
        intKeys.privateKey,
        '03',
        [
          { name: 'basicConstraints', cA: false },
          { name: 'keyUsage', digitalSignature: true, critical: true },
          { name: 'subjectAltName', altNames: [{ type: 6, value: sanURI }] },
        ]
      );

      return {
        leaf: derBase64(leaf),
        intermediate: derBase64(intermediate),
        root: derBase64(root),
      };
    }

    it('rejects a bundle whose certificate chain is fully self-signed', async () => {
      const chain = mintSelfSignedChain('ldap:///base-facilitators');

      // Start from a genuine bundle and keep its real signature + TSA timestamp so
      // verification reaches the certificate-chain stage; only the cert chain is
      // swapped for the self-minted one, laid out as [leaf, runtime intermediate,
      // static intermediate, root] to match the injection indices.
      const bundle = JSON.parse(
        await fs.readFile(
          path.join(VALID_SIGNATURES_DIR, 'base-facilitator-signature.json'),
          'utf8'
        )
      );
      bundle.verificationMaterial.x509CertificateChain.certificates = [
        { rawBytes: chain.leaf },
        { rawBytes: chain.intermediate },
        { rawBytes: chain.intermediate },
        { rawBytes: chain.root },
      ];

      const forgedSignatureFile = path.join(tempDir, 'base-facilitator-signature.json');
      await fs.writeFile(forgedSignatureFile, JSON.stringify(bundle));

      // The pins refuse to inject the self-minted root/intermediate as trust anchors,
      // so no trusted certificate path can be built for the forged leaf.
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile: forgedSignatureFile,
          commonName: 'base-facilitators',
          role: 'baseFacilitator' as TaskOriginRole,
        })
      ).rejects.toThrow(/certificate chain/i);
    }, 60000);
  });

  describe('malformed certificate chain', () => {
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'malformed-sig-'));
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true });
    });

    // The pinning logic assumes the bundle carries the full chain
    // [leaf, runtime intermediate, static intermediate, root]. A bundle missing the
    // runtime intermediate ([1]) or root ([3]) must be rejected outright rather than
    // silently falling through to a base-only chain.
    async function writeBundleWithChain(certificateCount: number): Promise<string> {
      const bundle = JSON.parse(
        await fs.readFile(
          path.join(VALID_SIGNATURES_DIR, 'base-facilitator-signature.json'),
          'utf8'
        )
      );
      bundle.verificationMaterial.x509CertificateChain.certificates =
        bundle.verificationMaterial.x509CertificateChain.certificates.slice(0, certificateCount);

      const signatureFile = path.join(tempDir, 'base-facilitator-signature.json');
      await fs.writeFile(signatureFile, JSON.stringify(bundle));
      return signatureFile;
    }

    it('rejects a bundle missing the root certificate', async () => {
      // Keep [leaf, runtime, static] but drop the root ([3]).
      const signatureFile = await writeBundleWithChain(3);
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile,
          commonName: 'base-facilitators',
          role: 'baseFacilitator' as TaskOriginRole,
        })
      ).rejects.toThrow('certificate chain must contain a runtime intermediate and root');
    });

    it('rejects a bundle with only a leaf certificate', async () => {
      // Only [leaf] present, so both the runtime intermediate ([1]) and root ([3]) are missing.
      const signatureFile = await writeBundleWithChain(1);
      await expect(
        buildAndValidateSignature({
          taskFolderPath: VALID_TASK_FOLDER,
          signatureFile,
          commonName: 'base-facilitators',
          role: 'baseFacilitator' as TaskOriginRole,
        })
      ).rejects.toThrow('certificate chain must contain a runtime intermediate and root');
    });
  });
});
