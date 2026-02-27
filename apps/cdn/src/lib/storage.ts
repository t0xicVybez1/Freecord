import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  BucketAlreadyOwnedByYou,
} from '@aws-sdk/client-s3'
import { createLogger } from '@freecord/logger'

const logger = createLogger('cdn:storage')

const BUCKET = process.env.MINIO_BUCKET || 'freecord'

export const s3 = new S3Client({
  endpoint: `${process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'}://${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
})

export async function ensureBucketExists() {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }))
    logger.info(`Created bucket: ${BUCKET}`)
  } catch (err) {
    if (err instanceof BucketAlreadyOwnedByYou) {
      logger.debug(`Bucket already exists: ${BUCKET}`)
    } else {
      throw err
    }
  }
}

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  )
}

export async function downloadFile(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    const body = Buffer.from(await response.Body!.transformToByteArray())
    return {
      body,
      contentType: response.ContentType || 'application/octet-stream',
    }
  } catch {
    return null
  }
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return true
  } catch {
    return false
  }
}
