import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export const imageFileFilter = (req: any, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return callback(new BadRequestException(`Invalid file type ${file.mimetype}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`), false);
  }
  callback(null, true);
};

export const paymentFileFilter = (req: any, file: Express.Multer.File, callback: (error: Error | null, acceptFile: boolean) => void) => {
  const ALLOWED = [...ALLOWED_IMAGE_TYPES, 'application/pdf'];
  if (!ALLOWED.includes(file.mimetype)) {
    return callback(new BadRequestException(`Invalid file type ${file.mimetype}. Allowed: ${ALLOWED.join(', ')}`), false);
  }
  callback(null, true);
};

export const MAX_FILE_SIZE = MAX_IMAGE_SIZE;
