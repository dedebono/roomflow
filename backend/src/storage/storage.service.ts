import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly uploadDir: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = path.resolve(__dirname, '..', '..', 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(file: Express.Multer.File): Promise<string> {
    const storageType = this.configService.get<string>('STORAGE_TYPE');

    if (storageType === 'LOCAL') {
      const fileName = `${uuidv4()}${path.extname(file.originalname)}`;
      const filePath = path.join(this.uploadDir, fileName);
      fs.writeFileSync(filePath, file.buffer);
      return `/uploads/${fileName}`;
    }

    // Placeholder for S3/Google Drive
    throw new Error('Storage type not implemented');
  }

  async delete(filePath: string): Promise<void> {
    const storageType = this.configService.get<string>('STORAGE_TYPE');

    if (storageType === 'LOCAL' && filePath.startsWith('/uploads/')) {
      const fullPath = path.join(this.uploadDir, path.basename(filePath));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  }
}
