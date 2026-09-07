import cloudinary from '../config/cloudinary';
import { Readable } from 'stream';
import { parseCloudinaryPublicId } from '../utils/cloudinaryUrl';
import { env } from '../config/env';

export interface UploadResult {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
}

export async function uploadImageBuffer(
  buffer: Buffer,
  folder: string,
  options: object = {}
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `nexmart/${folder}`,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No upload result'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
        });
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

export async function uploadPdfBuffer(
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `nexmart/${folder}`,
        resource_type: 'raw',
        public_id: filename,
        format: 'pdf',
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No upload result'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

export async function deleteCloudinaryAsset(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

// Delete a delivery URL's underlying asset. Strict parser: only URLs on our
// cloud under nexmart/ parse to a public_id — anything else is a no-op false,
// so a stray/foreign URL can never trigger a deletion (B11: product images
// used to be orphaned in the CDN forever when the product was deleted).
export async function deleteImageByUrl(url: string): Promise<boolean> {
  const publicId = parseCloudinaryPublicId(url, env.CLOUDINARY_CLOUD_NAME);
  if (!publicId) return false;
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  return result.result === 'ok';
}
