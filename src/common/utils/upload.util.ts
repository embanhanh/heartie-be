import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync, renameSync } from 'fs';
import { basename, extname, isAbsolute, join, relative } from 'path';
import { randomUUID } from 'crypto';
import { UploadedFile } from '../types/uploaded-file.type';

const UPLOAD_ROOT = 'uploads';

const SAFE_NAME_REGEX = /[^a-zA-Z0-9-_]+/g;

function sanitizeModuleName(moduleName: string): string {
  const sanitized = moduleName.trim().replace(SAFE_NAME_REGEX, '-').replace(/-+/g, '-');
  return sanitized || 'files';
}

function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function sanitizeBaseName(name: string): string {
  const cleaned = name.replace(SAFE_NAME_REGEX, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'file';
}

function buildFilename(originalName: string): string {
  const extension = extname(originalName) || '.bin';
  const base = sanitizeBaseName(basename(originalName, extension)).slice(-48);
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${base}${extension}`;
}

function isMimeAllowed(mimetype: string, allowed?: string[]): boolean {
  if (!allowed || !allowed.length) {
    return true;
  }

  return allowed.some((item) => {
    if (item.endsWith('/*')) {
      const prefix = item.slice(0, -1);
      return mimetype.startsWith(prefix);
    }

    return mimetype === item;
  });
}

export interface ModuleUploadOptions {
  moduleName: string;
  allowedMimeTypes?: string[];
  limits?: MulterOptions['limits'];
}

export function createModuleMulterOptions(options: ModuleUploadOptions): MulterOptions {
  const moduleName = sanitizeModuleName(options.moduleName);
  const uploadDir = join(process.cwd(), UPLOAD_ROOT, moduleName);

  ensureDirectory(uploadDir);

  return {
    storage: diskStorage({
      destination: (_, __, cb) => {
        try {
          ensureDirectory(uploadDir);
          cb(null, uploadDir);
        } catch (error) {
          cb(error as Error, uploadDir);
        }
      },
      filename: (_, file, cb) => {
        try {
          cb(null, buildFilename(file.originalname));
        } catch (error) {
          cb(error as Error, buildFilename('file'));
        }
      },
    }),
    fileFilter: (_, file, cb) => {
      if (!isMimeAllowed(file.mimetype, options.allowedMimeTypes)) {
        return cb(new BadRequestException('Invalid file type'), false);
      }

      cb(null, true);
    },
    limits: options.limits,
  };
}

function toRelativeUploadPath(targetPath: string): string {
  const rel = relative(process.cwd(), targetPath).replace(/\\/g, '/');
  return rel.startsWith(`${UPLOAD_ROOT}/`) ? rel : `${UPLOAD_ROOT}/${rel}`;
}

export function resolveModuleUploadPath(
  moduleName: string,
  file?: UploadedFile,
  fallback?: string | null,
): string | undefined {
  if (!file) {
    return fallback ?? undefined;
  }

  const sanitizedModule = sanitizeModuleName(moduleName);
  const uploadDir = join(process.cwd(), UPLOAD_ROOT, sanitizedModule);
  ensureDirectory(uploadDir);

  const candidate =
    file.path ??
    (file.destination && file.filename ? join(file.destination, file.filename) : undefined);

  if (!candidate) {
    return fallback ?? undefined;
  }

  const absoluteCandidate = isAbsolute(candidate) ? candidate : join(process.cwd(), candidate);

  let finalPath = absoluteCandidate;

  if (!absoluteCandidate.startsWith(uploadDir)) {
    const finalName = buildFilename(file.originalname || basename(absoluteCandidate));
    finalPath = join(uploadDir, finalName);

    try {
      renameSync(absoluteCandidate, finalPath);
    } catch {
      throw new BadRequestException('Không thể lưu trữ file tải lên');
    }
  }

  return toRelativeUploadPath(finalPath);
}

export { UPLOAD_ROOT };
