import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_ATTACHMENT_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

function ensureUploadSubdir(subdir: string): string {
  const safeSubdir = subdir.replace(/[^a-z0-9_-]/gi, '');
  const targetDir = path.resolve(env.uploadDir, safeSubdir);
  if (!targetDir.startsWith(env.uploadDir + path.sep) && targetDir !== env.uploadDir) {
    throw new Error('Invalid upload directory');
  }
  fs.mkdirSync(targetDir, { recursive: true });
  return targetDir;
}

function createDiskUpload(subdir: string, allowPdf: boolean, maxSizeBytes: number) {
  const allowed = allowPdf ? ALLOWED_ATTACHMENT_MIMES : ALLOWED_IMAGE_MIMES;

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        const dir = ensureUploadSubdir(subdir);
        cb(null, dir);
      } catch (err: any) {
        cb(err, env.uploadDir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = MIME_EXT[file.mimetype] || '.bin';
      const randomName = `${Date.now()}_${crypto.randomBytes(12).toString('hex')}${ext}`;
      cb(null, randomName);
    },
  });

  return multer({
    storage,
    limits: { fileSize: maxSizeBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!allowed.has(file.mimetype)) {
        cb(new Error(allowPdf ? 'Only JPG, PNG, WEBP, or PDF files are allowed.' : 'Only JPG, PNG, or WEBP image files are allowed.'));
        return;
      }
      cb(null, true);
    },
  });
}

export const depositScreenshotUpload = createDiskUpload('deposits', false, 5 * 1024 * 1024);
export const supportAttachmentUpload = createDiskUpload('support', true, 5 * 1024 * 1024);
export const profileAvatarUpload = createDiskUpload('avatars', false, 3 * 1024 * 1024);

export function toPublicUploadUrl(subdir: string, filename: string | undefined): string | null {
  if (!filename) return null;
  const safeSub = subdir.replace(/[^a-z0-9_-]/gi, '');
  const safeName = path.basename(filename);
  return `/uploads/${safeSub}/${safeName}`;
}

export function resolveSafeUploadPath(subdir: string, filename: string): string | null {
  const safeSub = subdir.replace(/[^a-z0-9_-]/gi, '');
  const safeName = path.basename(filename);
  const fullPath = path.resolve(env.uploadDir, safeSub, safeName);
  const allowedBase = path.resolve(env.uploadDir) + path.sep;
  if (!fullPath.startsWith(allowedBase)) {
    return null;
  }
  return fullPath;
}
