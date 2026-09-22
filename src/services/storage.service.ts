import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EnvConfig } from '../config/env.config.js';
import { APP_CONSTANTS } from '../config/constants.js';
import { Logger } from '../utils/logger.js';
import type { Readable } from 'node:stream';

export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger: Logger;

  constructor(s3Client?: S3Client) {
    const config = EnvConfig.getInstance();
    this.logger = new Logger('StorageService');
    this.bucketName = config.r2BucketName;

    if (s3Client) {
      this.s3Client = s3Client;
    } else {
      const endpoint = config.r2Endpoint || (config.r2AccountId ? `https://${config.r2AccountId}.r2.cloudflarestorage.com` : '');
      this.s3Client = new S3Client({
        region: 'auto',
        ...(endpoint ? { endpoint } : {}),
        credentials: {
          accessKeyId: config.r2AccessKeyId,
          secretAccessKey: config.r2SecretAccessKey,
        },
      });
    }
  }

  public async getPresignedUploadUrl(
    storageKey: string,
    contentType: string,
    expiresInSeconds: number = APP_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      ContentType: contentType,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  public async getPresignedDownloadUrl(
    storageKey: string,
    expiresInSeconds: number = APP_CONSTANTS.PRESIGNED_URL_EXPIRY_SECONDS
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  public async deleteObject(storageKey: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: storageKey,
      });
      await this.s3Client.send(command);
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete object: ${storageKey}`, err);
      return false;
    }
  }

  public async deleteObjects(storageKeys: string[]): Promise<boolean> {
    if (storageKeys.length === 0) return true;
    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucketName,
        Delete: {
          Objects: storageKeys.map((key) => ({ Key: key })),
        },
      });
      await this.s3Client.send(command);
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete objects batch`, err);
      return false;
    }
  }

  public async getObjectStream(storageKey: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });
    const response = await this.s3Client.send(command);
    return response.Body as Readable;
  }
}
