import { describe, it, expect } from 'vitest';
import { parseCloudinaryPublicId } from '../cloudinaryUrl';

const CLOUD = 'drb7nw0o9';

describe('parseCloudinaryPublicId (B11: safe URL → public_id for asset deletion)', () => {
  it('parses a versioned product image URL', () => {
    expect(
      parseCloudinaryPublicId(
        'https://res.cloudinary.com/drb7nw0o9/image/upload/v1788771101/nexmart/products/lugotntrbh69av16p8xc.png',
        CLOUD
      )
    ).toBe('nexmart/products/lugotntrbh69av16p8xc');
  });

  it('parses a URL without a version segment', () => {
    expect(
      parseCloudinaryPublicId('https://res.cloudinary.com/drb7nw0o9/image/upload/nexmart/products/foo.jpg', CLOUD)
    ).toBe('nexmart/products/foo');
  });

  it('returns null for a foreign cloud (never delete what we do not own)', () => {
    expect(
      parseCloudinaryPublicId('https://res.cloudinary.com/othercloud/image/upload/v1/nexmart/products/foo.png', CLOUD)
    ).toBeNull();
  });

  it('returns null for assets outside the nexmart/ folder', () => {
    expect(
      parseCloudinaryPublicId('https://res.cloudinary.com/drb7nw0o9/image/upload/v1/someoneelse/foo.png', CLOUD)
    ).toBeNull();
  });

  it('returns null for non-Cloudinary URLs', () => {
    expect(parseCloudinaryPublicId('https://example.com/a.png', CLOUD)).toBeNull();
    expect(parseCloudinaryPublicId('not a url', CLOUD)).toBeNull();
  });

  it('handles public ids containing dots', () => {
    expect(
      parseCloudinaryPublicId('https://res.cloudinary.com/drb7nw0o9/image/upload/v1/nexmart/products/foo.bar.png', CLOUD)
    ).toBe('nexmart/products/foo.bar');
  });
});
