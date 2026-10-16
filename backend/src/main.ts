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
     origin: true, // Mengizinkan semua origin yang melakukan request
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
