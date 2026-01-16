import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UploadFileResponseDto } from './dto/upload.dto';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import { UploadedFile } from '../../common/types/uploaded-file.type';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  async uploadSingle(file: UploadedFile, folder?: string): Promise<UploadFileResponseDto> {
    const [result] = await this.uploadMany([file], folder);
    return result;
  }

  async uploadMany(files: UploadedFile[], folder?: string): Promise<UploadFileResponseDto[]> {
    if (!files?.length) {
      throw new BadRequestException('Không tìm thấy file tải lên');
    }

    const sanitizedFolder = this.sanitizeFolder(folder);
    const tasks = files.map((file) => this.uploadToCloudinary(file, sanitizedFolder));
    return Promise.all(tasks);
  }

  private uploadToCloudinary(
    file: UploadedFile,
    folder: string | null,
  ): Promise<UploadFileResponseDto> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder || 'heartie', // default folder
          filename_override: this.buildFilename(file.originalname),
          public_id: this.buildPublicId(file.originalname),
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            this.logger.error(`Upload error: ${error.message}`, error);
            return reject(new BadRequestException('Upload thất bại'));
          }

          if (!result) {
            return reject(new BadRequestException('Cloudinary did not return a result'));
          }

          resolve({
            filename: result.public_id,
            originalName: file.originalname,
            size: result.bytes,
            mimeType:
              result.resource_type === 'image'
                ? `image/${result.format}`
                : 'application/octet-stream',
            path: result.secure_url,
            url: result.secure_url,
            folder: folder || '',
          });
        },
      );

      if (!file.buffer) {
        return reject(new BadRequestException('File buffer is missing'));
      }

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  private sanitizeFolder(folder?: string): string | null {
    if (!folder) {
      return null;
    }

    const segments = folder
      .split(/[\\/]/g)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => segment.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-'))
      .filter(Boolean);

    if (!segments.length) {
      return null;
    }

    // Cloudinary folders don't need leading/trailing slashes, just forward slashes
    return segments.join('/').toLowerCase();
  }

  private buildFilename(originalName?: string): string {
    const safeName = originalName && originalName.trim().length ? originalName : 'file';
    // Replace spaces with underscores and remove non-alphanumeric chars (keep dots/underscores/hyphens)
    return safeName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9-_.]/g, '');
  }

  private buildPublicId(originalName?: string): string {
    // Create a unique public ID: uuid-slugifiedName without extension
    const safeName = originalName && originalName.trim().length ? originalName : 'file';
    const nameWithoutExt = safeName.substring(0, safeName.lastIndexOf('.')) || safeName;
    const slug = nameWithoutExt.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9-_]/g, '');
    return `${randomUUID().slice(0, 8)}-${slug}`;
  }
}
