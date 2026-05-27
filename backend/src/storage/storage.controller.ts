import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('storage')
@Roles(Role.ADMIN_IT)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('config')
  getConfig() {
    return {
      storageType: this.storageService.getStorageType(),
    };
  }

  @Post('config')
  @HttpCode(HttpStatus.OK)
  updateConfig(@Body('storageType') storageType: string) {
    this.storageService.setStorageType(storageType);
    return {
      storageType,
      message: `Storage provider switched to ${storageType}`,
    };
  }
}
