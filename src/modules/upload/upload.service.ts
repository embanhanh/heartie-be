import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';
import { Express } from 'express';
import { UPLOAD_ROOT } from '../../common/utils/upload.util';
import { UploadFileResponseDto } from './dto/upload.dto';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  async uploadSingle(file: Express.Multer.File, folder?: string): Promise<UploadFileResponseDto> {
    const [result] = await this.uploadMany([file], folder);
    return result;
  }

  async uploadMany(
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<UploadFileResponseDto[]> {
    if (!files?.length) {
      throw new BadRequestException('Không tìm thấy file tải lên');
    }

    const sanitizedFolder = this.sanitizeFolder(folder);
    const targetDir = await this.ensureTargetDirectory(sanitizedFolder);

    const tasks = files.map((file) => this.persistFile(file, targetDir, sanitizedFolder));
    return Promise.all(tasks);
  }

  private async persistFile(
    file: Express.Multer.File,
    targetDir: string,
    sanitizedFolder: string | null,
  ): Promise<UploadFileResponseDto> {
    const filename = this.buildFilename(file.originalname);
    const absolutePath = join(targetDir, filename);

    if (file.buffer) {
      await fs.writeFile(absolutePath, file.buffer);
    } else if (file.path) {
      await this.moveExistingFile(file.path, absolutePath);
    } else {
      throw new BadRequestException('File tải lên không hợp lệ');
    }

    const relativePath = this.buildRelativePath(filename, sanitizedFolder);

    this.logger.debug(
      `Stored file ${file.originalname} (${file.mimetype}) as ${relativePath} (${file.size} bytes)`,
    );

    return {
      filename,
      originalName: file.originalname ?? filename,
      size: file.size,
      mimeType: file.mimetype,
      path: relativePath,
      url: `/${relativePath}`,
      folder: sanitizedFolder ?? '',
    } satisfies UploadFileResponseDto;
  }

  private async moveExistingFile(source: string, destination: string): Promise<void> {
    try {
      await fs.rename(source, destination);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`rename(${source} -> ${destination}) failed, fallback to copy: ${message}`);
    }

    await fs.copyFile(source, destination);
    await fs.unlink(source).catch(() => undefined);
  }

  private buildRelativePath(filename: string, sanitizedFolder: string | null): string {
    const folderPath = sanitizedFolder ? `${UPLOAD_ROOT}/${sanitizedFolder}` : UPLOAD_ROOT;
    return `${folderPath}/${filename}`.replace(/\\/g, '/');
  }

  private async ensureTargetDirectory(folder?: string | null): Promise<string> {
    const relativeFolder = folder ? `${UPLOAD_ROOT}/${folder}` : UPLOAD_ROOT;
    const absoluteDir = join(process.cwd(), relativeFolder);
    await fs.mkdir(absoluteDir, { recursive: true });
    return absoluteDir;
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

    return segments.join('/').toLowerCase();
  }

  private buildFilename(originalName?: string): string {
    const safeName = originalName && originalName.trim().length ? originalName : 'upload.bin';
    const extension = extname(safeName) || '.bin';
    const base = basename(safeName, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 48);
    return `${Date.now()}-${randomUUID().slice(0, 8)}-${base || 'file'}${extension}`;
  }
}
