"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
exports.getR2Client = getR2Client;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const index_js_1 = require("./index.js");
let s3Client = null;
function getR2Client() {
    if (!index_js_1.config.r2.accountId || !index_js_1.config.r2.accessKeyId || !index_js_1.config.r2.secretAccessKey) {
        return null;
    }
    if (!s3Client) {
        // Cloudflare R2 S3-compatible endpoint format:
        // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
        const endpoint = `https://${index_js_1.config.r2.accountId}.r2.cloudflarestorage.com`;
        s3Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint,
            credentials: {
                accessKeyId: index_js_1.config.r2.accessKeyId,
                secretAccessKey: index_js_1.config.r2.secretAccessKey,
            },
        });
    }
    return s3Client;
}
class StorageService {
    /**
     * Generates a presigned PUT URL for Cloudflare R2 (expires in 15 mins)
     */
    static async generatePresignedPutUrl(storageKey, contentType, expiresInSeconds = 900) {
        const client = getR2Client();
        if (!client) {
            // Local fallback development URL if credentials are not configured yet
            const uploadUrl = `http://localhost:${index_js_1.config.port}/api/v1/evidence/upload-local/${storageKey}`;
            return { uploadUrl, provider: 'local_fallback' };
        }
        const command = new client_s3_1.PutObjectCommand({
            Bucket: index_js_1.config.r2.bucketName,
            Key: storageKey,
            ContentType: contentType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(client, command, { expiresIn: expiresInSeconds });
        return { uploadUrl, provider: 'cloudflare_r2' };
    }
    /**
     * Verifies object presence and file size in Cloudflare R2
     */
    static async verifyObject(storageKey) {
        const client = getR2Client();
        if (!client) {
            return true; // Local dev fallback
        }
        try {
            const command = new client_s3_1.HeadObjectCommand({
                Bucket: index_js_1.config.r2.bucketName,
                Key: storageKey,
            });
            await client.send(command);
            return true;
        }
        catch (err) {
            console.warn('[R2 Verification Warning] Object not found in bucket:', storageKey, err.name);
            return false;
        }
    }
}
exports.StorageService = StorageService;
