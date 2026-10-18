import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import * as express from 'express';
import { join } from 'path';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [];

  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://100.127.221.23',
    'http://100.127.221.23:3000',
    'http://100.127.221.23:3001',
   ];

  const allowedOrigins = Array.from(new Set([...envOrigins, ...defaultOrigins])).filter(Boolean);

  app.enableCors({
    // Pakai allowlist, BUKAN `origin: true`.
    //
    // Sebelumnya `allowedOrigins` dihitung lalu dibuang, sehingga setiap
    // origin diteruskan apa adanya — termasuk https://evil.example.com.
    // Yang amplifying dampaknya: token disimpan di localStorage, jadi CORS
    // longgar + Authorization header = situs mana pun bisa memanggil API
    // atas nama user yang sedang login di venueone (harus login dulu,
    // localStorage tidak dibaca lintas origin, tapi tetap jauh lebih longgar
    // dari allowlist yang diiklankan di AUDIT.md).
    //
    // `origin` sebagai fungsi menolak origin yang tidak terdaftar; header
    // allow-origin hanya dikembalikan untuk yang lolos.
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Request tanpa Origin (curl, health check, same-origin non-CORS)
      // bukan browser cross-origin — biarkan lewat.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin tidak diizinkan.'), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Serve static files for uploads
  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // WebSocket adapter for Socket.IO
  app.useWebSocketAdapter(new IoAdapter(app));

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: http://localhost:${port}/api`);
}
bootstrap();
