import { normalizeUrl } from '../deployments';

describe('normalizeUrl', () => {
  describe('valid URLs', () => {
    it('accepts valid https URL', () => {
      const url = 'https://etherscan.io/tx/0x123';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('accepts valid http URL', () => {
      const url = 'http://example.com/path';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('trims whitespace from valid URL', () => {
      expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com');
    });

    it('strips trailing punctuation from valid URL', () => {
      expect(normalizeUrl('https://example.com/path).')).toBe('https://example.com/path');
      expect(normalizeUrl('https://example.com/path],')).toBe('https://example.com/path');
      expect(normalizeUrl('https://example.com/path...')).toBe('https://example.com/path');
    });
  });

  describe('malformed URLs', () => {
    it('rejects empty string', () => {
      expect(normalizeUrl('')).toBeUndefined();
    });

    it('rejects bare http string', () => {
      expect(normalizeUrl('http')).toBeUndefined();
    });

    it('rejects http without proper URL structure', () => {
      expect(normalizeUrl('http://')).toBeUndefined();
    });

    it('rejects httpxyz fake protocol', () => {
      expect(normalizeUrl('httpxyz://not-valid')).toBeUndefined();
    });

    it('rejects http:not-a-url format', () => {
      expect(normalizeUrl('http:not-a-url')).toBeUndefined();
    });

    it('rejects random text', () => {
      expect(normalizeUrl('not a url at all')).toBeUndefined();
    });

    it('rejects ftp protocol', () => {
      expect(normalizeUrl('ftp://files.example.com')).toBeUndefined();
    });

    it('rejects javascript protocol', () => {
      expect(normalizeUrl('javascript:alert(1)')).toBeUndefined();
    });

    it('rejects file protocol', () => {
      expect(normalizeUrl('file:///etc/passwd')).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles URL with query parameters', () => {
      const url = 'https://example.com/path?foo=bar&baz=qux';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('handles URL with fragment', () => {
      const url = 'https://example.com/path#section';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('handles URL with port', () => {
      const url = 'https://example.com:8080/path';
      expect(normalizeUrl(url)).toBe(url);
    });

    it('handles URL with authentication', () => {
      const url = 'https://user:pass@example.com/path';
      expect(normalizeUrl(url)).toBe(url);
    });
  });
});
