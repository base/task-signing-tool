import { AddressSchema, HashSchema, ExpectedHashesSchema } from '../config-schemas';

describe('AddressSchema', () => {
  it('accepts valid lowercase address and returns checksummed', () => {
    const lowercase = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
    const result = AddressSchema.parse(lowercase);
    // viem checksums to: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
    expect(result).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  });

  it('accepts valid checksummed address unchanged', () => {
    const checksummed = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const result = AddressSchema.parse(checksummed);
    expect(result).toBe(checksummed);
  });

  it('rejects all-uppercase address (viem treats as invalid checksum)', () => {
    // viem's isAddress() only accepts all-lowercase or valid EIP-55 checksummed
    const uppercase = '0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045';
    expect(() => AddressSchema.parse(uppercase)).toThrow();
  });

  it('rejects mixed-case address with invalid checksum', () => {
    // This has mixed case but wrong checksum (swapped one char case)
    const invalidChecksum = '0xd8Da6bf26964af9d7eed9e03e53415d37aa96045';
    expect(() => AddressSchema.parse(invalidChecksum)).toThrow();
  });

  it('rejects address with invalid format (wrong length)', () => {
    const tooShort = '0xd8da6bf26964af9d7eed9e03e53415d37aa9604';
    expect(() => AddressSchema.parse(tooShort)).toThrow();
  });

  it('rejects address without 0x prefix', () => {
    const noPrefix = 'd8da6bf26964af9d7eed9e03e53415d37aa96045';
    expect(() => AddressSchema.parse(noPrefix)).toThrow();
  });

  it('rejects address with invalid hex characters', () => {
    const invalidHex = '0xd8da6bf26964af9d7eed9e03e53415d37aa9604g';
    expect(() => AddressSchema.parse(invalidHex)).toThrow();
  });
});

describe('HashSchema', () => {
  it('accepts valid 32-byte hash', () => {
    const hash = '0x' + 'a'.repeat(64);
    expect(HashSchema.parse(hash)).toBe(hash);
  });

  it('rejects hash with wrong length', () => {
    const tooShort = '0x' + 'a'.repeat(63);
    expect(() => HashSchema.parse(tooShort)).toThrow();
  });

  it('rejects hash without 0x prefix', () => {
    const noPrefix = 'a'.repeat(64);
    expect(() => HashSchema.parse(noPrefix)).toThrow();
  });
});

describe('ExpectedHashesSchema', () => {
  it('accepts valid object and normalizes address', () => {
    const input = {
      address: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
      domainHash: '0x' + 'a'.repeat(64),
      messageHash: '0x' + 'b'.repeat(64),
    };
    const result = ExpectedHashesSchema.parse(input);
    expect(result.address).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    expect(result.domainHash).toBe(input.domainHash);
    expect(result.messageHash).toBe(input.messageHash);
  });

  it('rejects object with invalid address', () => {
    const input = {
      address: 'invalid',
      domainHash: '0x' + 'a'.repeat(64),
      messageHash: '0x' + 'b'.repeat(64),
    };
    expect(() => ExpectedHashesSchema.parse(input)).toThrow();
  });
});
