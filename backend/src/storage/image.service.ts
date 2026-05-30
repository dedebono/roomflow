import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const sharp = require('sharp');

@Injectable()
export class ImageService {
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async compressAndSave(file: Express.Multer.File): Promise<string> {
    const fileName = `${uuidv4()}.webp`;
    const filePath = path.join(this.uploadDir, fileName);

    try {
      // Compress image to WebP format, max 1200px width, 80% quality
      await sharp(file.buffer)
        .resize(1200, 800, {
          fit: 'cover',
          position: 'center',
        })
        .webp({ quality: 80 })
        .toFile(filePath);

      return `/uploads/${fileName}`;
    } catch (error) {
      // If image processing fails, save original file
      const originalFileName = `${uuidv4()}${path.extname(file.originalname)}`;
      const originalFilePath = path.join(this.uploadDir, originalFileName);
      fs.writeFileSync(originalFilePath, file.buffer);
      return `/uploads/${originalFileName}`;
    }
  }

  async delete(filePath: string): Promise<void> {
    if (filePath.startsWith('/uploads/')) {
      const fullPath = path.join(this.uploadDir, path.basename(filePath));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  }
}
