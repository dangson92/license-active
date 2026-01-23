/**
 * iDrive E2 Storage Service
 * Sử dụng AWS S3 SDK vì iDrive E2 tương thích S3 API
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import fs from 'fs'
import path from 'path'

// Initialize S3 client for iDrive E2
const getS3Client = () => {
    let endpoint = process.env.IDRIVE_E2_ENDPOINT
    const accessKey = process.env.IDRIVE_E2_ACCESS_KEY
    const secretKey = process.env.IDRIVE_E2_SECRET_KEY

    if (!endpoint || !accessKey || !secretKey) {
        throw new Error('iDrive E2 credentials not configured. Please set IDRIVE_E2_ENDPOINT, IDRIVE_E2_ACCESS_KEY, and IDRIVE_E2_SECRET_KEY environment variables.')
    }

    // Auto-add https:// if missing
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        endpoint = `https://${endpoint}`
    }

    console.log(`🔗 Connecting to iDrive E2: ${endpoint}`)

    return new S3Client({
        endpoint: endpoint,
        region: 'e2', // iDrive E2 uses 'e2' as region
        credentials: {
            accessKeyId: accessKey,
            secretAccessKey: secretKey,
        },
        forcePathStyle: true, // Required for iDrive E2
    })
}

/**
 * Upload file to iDrive E2
 * @param {Object} options Upload options
 * @param {string} options.filePath - Local file path
 * @param {string} options.key - S3 object key (path in bucket)
 * @param {string} options.contentType - MIME type
 * @param {Function} options.onProgress - Progress callback (optional)
 * @returns {Promise<{url: string, key: string, size: number}>}
 */
export async function uploadToE2({ filePath, key, contentType, onProgress }) {
    const s3Client = getS3Client()
    const bucket = process.env.IDRIVE_E2_BUCKET

    if (!bucket) {
        throw new Error('iDrive E2 bucket not configured. Please set IDRIVE_E2_BUCKET environment variable.')
    }

    console.log(`📂 Uploading to bucket: ${bucket}, key: ${key}`)

    // Read file stream
    const fileStream = fs.createReadStream(filePath)
    const fileStats = fs.statSync(filePath)

    console.log(`📁 File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`)

    try {
        // Use multipart upload for large files
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: bucket,
                Key: key,
                Body: fileStream,
                ContentType: contentType || 'application/octet-stream',
                // Note: ACL removed - not all S3-compatible services support it
                // Configure bucket policy for public access instead
            },
            queueSize: 4, // Concurrent upload parts
            partSize: 10 * 1024 * 1024, // 10MB parts
            leavePartsOnError: false,
        })

        // Track upload progress
        upload.on('httpUploadProgress', (progress) => {
            if (onProgress && progress.total) {
                const percentage = Math.round((progress.loaded / progress.total) * 100)
                onProgress(percentage)
            }
        })

        await upload.done()
        console.log(`✅ Upload to E2 completed successfully`)

        // Build public URL
        const publicUrl = process.env.IDRIVE_E2_PUBLIC_URL
            ? `${process.env.IDRIVE_E2_PUBLIC_URL}/${key}`
            : `${process.env.IDRIVE_E2_ENDPOINT}/${bucket}/${key}`

        return {
            url: publicUrl,
            key: key,
            size: fileStats.size,
        }
    } catch (error) {
        console.error('❌ E2 Upload Error Details:', {
            name: error.name,
            message: error.message,
            code: error.Code || error.code,
            statusCode: error.$metadata?.httpStatusCode,
        })
        throw error
    }
}

/**
 * Delete file from iDrive E2
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>}
 */
export async function deleteFromE2(key) {
    const s3Client = getS3Client()
    const bucket = process.env.IDRIVE_E2_BUCKET

    if (!bucket) {
        throw new Error('iDrive E2 bucket not configured.')
    }

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        }))
        return true
    } catch (error) {
        console.error('Error deleting from E2:', error)
        return false
    }
}

/**
 * Generate S3 key for app version file
 * @param {string} appCode - Application code
 * @param {string} version - Version string
 * @param {string} filename - Original filename
 * @returns {string} S3 key
 */
export function generateE2Key(appCode, version, filename) {
    const ext = path.extname(filename)
    // Format: releases/{appCode}/{appCode}-{version}.zip
    return `releases/${appCode}/${appCode}-${version}${ext}`
}

/**
 * Check if iDrive E2 is configured
 * @returns {boolean}
 */
export function isE2Configured() {
    return !!(
        process.env.IDRIVE_E2_ENDPOINT &&
        process.env.IDRIVE_E2_ACCESS_KEY &&
        process.env.IDRIVE_E2_SECRET_KEY &&
        process.env.IDRIVE_E2_BUCKET
    )
}
