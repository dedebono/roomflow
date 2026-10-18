import { Controller, Get, Post, Delete, Body, Headers, Param, Query } from '@nestjs/common';
import { CheckoutService } from './checkout.service';
import { SeriesService } from './series.service';
import { CheckoutDto, AddCartItemDto } from './dto/checkout.dto';
import { AddSeriesDto } from './dto/series.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

/**
 * Alur renter: keranjang -> checkout -> bayar.
 * Endpoint ini adalah tempat DUA-SATUNNYA kunci slot dibuat untuk renter.
 */
@Controller()
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly seriesService: SeriesService,
  ) {}

  // --- Keranjang (tidak mengunci apa pun) ----------------------------------

  @Get('cart')
  getCart(@CurrentUser('userId') userId: string) {
    return this.checkoutService.getCart(userId);
  }

  @Post('cart/items')
  addCartItem(@CurrentUser('userId') userId: string, @Body() dto: AddCartItemDto) {
    return this.checkoutService.addCartItem(userId, dto);
  }

  @Delete('cart/items/:id')
  removeCartItem(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.checkoutService.removeCartItem(userId, id);
  }

  @Delete('cart')
  clearCart(@CurrentUser('userId') userId: string) {
    return this.checkoutService.clearCart(userId);
  }

  // --- Sewa berkala / banyak ruangan sekaligus ------------------------------

  /**
   * PREVIEW paket sewa berkala. TIDAK menulis apa pun dan tidak mengunci slot.
   * Frontend memakai ini untuk menampilkan "12 sesi x 3 ruangan, total Rp X"
   * sebelum user menekan tombol, sehingga harga yang tampil di layar
   * sama dengan harga yang akan ditagih.
   */
  @Post('series/preview')
  @Roles(Role.RENTER, Role.USER, Role.ADMIN_IT, Role.ROOM_ADMIN)
  previewSeries(@Body() dto: AddSeriesDto) {
    return this.seriesService.preview(dto);
  }

  /**
   * Masukkan paket sewa berkala ke keranjang. Tetap tidak mengunci slot —
   * kunci tetap dibuat di /checkout, sama seperti item biasa.
   */
  @Post('series/cart')
  @Roles(Role.RENTER, Role.USER, Role.ADMIN_IT, Role.ROOM_ADMIN)
  addSeriesToCart(@CurrentUser('userId') userId: string, @Body() dto: AddSeriesDto) {
    return this.seriesService.addToCart(userId, dto);
  }

  // --- Checkout -------------------------------------------------------------

  /**
   * WAJIB Idempotency-Key. Retry dengan key yang sama mengembalikan Order
   * yang sama dan TIDAK memanggil gateway lagi. Key dibuat di frontend.
   */
  @Post('checkout')
  @Roles(Role.RENTER, Role.USER, Role.ADMIN_IT, Role.ROOM_ADMIN)
  checkout(
    @CurrentUser('userId') userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CheckoutDto,
  ) {
    return this.checkoutService.checkout(userId, dto, idempotencyKey);
  }

  /** Perpanjang hold +5 menit, maksimal sekali. */
  @Post('orders/:id/extend-hold')
  extendHold(
    @CurrentUser('userId') userId: string,
    @Param('id') orderId: string,
  ) {
    return this.checkoutService.extendHold(userId, orderId);
  }

  /** Polling status untuk halaman pembayaran. TIDAK pernah mengubah state. */
  @Get('orders/:id')
  getOrder(
    @CurrentUser('userId') userId: string,
    @Param('id') orderId: string,
  ) {
    return this.checkoutService.getOrder(userId, orderId);
  }

  @Get('orders')
  listMyOrders(@CurrentUser('userId') userId: string, @Query('limit') limit?: number) {
    return this.checkoutService.myOrders(userId, limit);
  }
}
