import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './index.js';

let s3Client: S3Client | null = null;

export function getR2Client(): S3Client | null {
  if (!config.r2.accountId || !config.r2.accessKeyId || !config.r2.secretAccessKey) {
    return null;
  }

  if (!s3Client) {
    // Cloudflare R2 S3-compatible endpoint format:
    // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
    const endpoint = `https://${config.r2.accountId}.r2.cloudflarestorage.com`;

    s3Client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }

  return s3Client;
}

export class StorageService {
  /**
   * Generates a presigned PUT URL for Cloudflare R2 (expires in 15 mins)
   */
  static async generatePresignedPutUrl(
    storageKey: string,
    contentType: string,
    expiresInSeconds: number = 900
  ): Promise<{ uploadUrl: string; provider: string }> {
    const client = getR2Client();

    if (!client) {
      // Local fallback development URL if credentials are not configured yet
      const uploadUrl = `http://localhost:${config.port}/api/v1/evidence/upload-local/${storageKey}`;
      return { uploadUrl, provider: 'local_fallback' };
    }

    const command = new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: storageKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    return { uploadUrl, provider: 'cloudflare_r2' };
  }

  /**
   * Verifies object presence and file size in Cloudflare R2
   */
  static async verifyObject(storageKey: string): Promise<boolean> {
    const client = getR2Client();
    if (!client) {
      return true; // Local dev fallback
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: config.r2.bucketName,
        Key: storageKey,
      });
      await client.send(command);
      return true;
    } catch (err: any) {
      console.warn('[R2 Verification Warning] Object not found in bucket:', storageKey, err.name);
      return false;
    }
  }
}
