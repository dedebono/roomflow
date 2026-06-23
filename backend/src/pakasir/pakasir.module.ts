import { Module } from '@nestjs/common';
import { PakasirService } from './pakasir.service';
import { PakasirController } from './pakasir.controller';

@Module({
  controllers: [PakasirController],
  providers: [PakasirService],
  exports: [PakasirService],
})
export class PakasirModule {}
