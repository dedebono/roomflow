import { Module, forwardRef } from '@nestjs/common';
import { PakasirService } from './pakasir.service';
import { PakasirController } from './pakasir.controller';
import { CheckoutModule } from '../checkout/checkout.module';

// Circular: PakasirController butuh SettlementService (dari CheckoutModule),
// CheckoutModule butuh PakasirService. forwardRef menyelesaikan.
@Module({
  imports: [forwardRef(() => CheckoutModule)],
  controllers: [PakasirController],
  providers: [PakasirService],
  exports: [PakasirService],
})
export class PakasirModule {}
