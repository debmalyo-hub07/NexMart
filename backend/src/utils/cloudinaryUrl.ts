// Cloudinary delivery-URL → public_id parser, used to destroy assets when the
// DB record that referenced them is deleted (e.g. deleteProduct). Strict on
// purpose: only our cloud, only the nexmart/ tree, only image deliveries —
// anything else parses to null and the caller skips deletion.

import { escapeRegExp } from './helpers';

export function parseCloudinaryPublicId(url: string, cloudName: string): string | null {
  if (typeof url !== 'string' || !url) return null;
  // https://res.cloudinary.com/<cloud>/image/upload/[v<version>/]<public_id>.<ext>
  const match = url.match(
    new RegExp(`^https://res\\.cloudinary\\.com/${escapeRegExp(cloudName)}/image/upload/(?:v\\d+/)?([^?]+?)\\.[a-zA-Z0-9]+$`)
  );
  if (!match) return null;
  const publicId = match[1];
  if (!publicId.startsWith('nexmart/')) return null;
  return publicId;
}
