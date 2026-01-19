import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const allowedOrigins: string[] =
    configService.get<string[]>('cors.allowedOrigins') || [];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin matches any allowed pattern
      for (const allowedOrigin of allowedOrigins) {
        if (origin === allowedOrigin) {
          return callback(null, true);
        }

        // localhost with any port
        if (
          allowedOrigin === 'http://localhost' &&
          origin.match(/^http:\/\/localhost(:\d+)?$/)
        ) {
          return callback(null, true);
        }

        // Domain with all subdomains (*.example.com) - Check .env.example
        if (allowedOrigin.startsWith('https://')) {
          const domain = allowedOrigin.replace('https://', '');
          const escapedDomain = domain.replace(/\./g, '\\.');
          const pattern = new RegExp(
            `^https:\\/\\/([a-z0-9-]+\\.)*${escapedDomain}$`,
          );
          if (origin.match(pattern)) {
            return callback(null, true);
          }
        }
      }

      // Reject all other origins
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 3600, // Cache preflight requests for 1 hour
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Podcast is running on: ${port}`);
}
void bootstrap();
