import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ImageService } from './image.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  providers: [StorageService, ImageService],
  controllers: [StorageController],
  exports: [StorageService, ImageService],
})
export class StorageModule {}
