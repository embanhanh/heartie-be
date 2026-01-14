import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { UploadedFile } from '../types/uploaded-file.type';

export const UPLOAD_ROOT = 'uploads';

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
  return {
    storage: memoryStorage(),
    fileFilter: (_, file, cb) => {
      if (!isMimeAllowed(file.mimetype, options.allowedMimeTypes)) {
        return cb(new BadRequestException('Invalid file type'), false);
      }

      cb(null, true);
    },
    limits: options.limits,
  };
}

export function resolveModuleUploadPath(
  moduleName: string,
  file?: UploadedFile,
  fallback?: string | null,
): string | undefined {
  if (!file) {
    return fallback ?? undefined;
  }
  return undefined;
}
