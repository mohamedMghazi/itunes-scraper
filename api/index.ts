import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import serverless, { Handler } from 'serverless-http';
import express, { Request, Response } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

let cachedServer: Handler | null = null;

async function bootstrap() {
  if (!cachedServer) {
    const expressApp = express();

    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
    );

    const configService = app.get(ConfigService);
    const allowedOrigins =
      configService.get<string[]>('cors.allowedOrigins') || [];

    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) return callback(null, true);

        for (const allowedOrigin of allowedOrigins) {
          if (origin === allowedOrigin) return callback(null, true);

          if (
            allowedOrigin === 'http://localhost' &&
            /^http:\/\/localhost(:\d+)?$/.exec(origin)
          ) {
            return callback(null, true);
          }

          if (allowedOrigin.startsWith('https://')) {
            const domain = allowedOrigin.replace('https://', '');
            const escapedDomain = domain.replace(/\./g, '\\.');
            const pattern = new RegExp(
              `^https:\\/\\/([a-z0-9-]+\\.)*${escapedDomain}$`,
            );
            if (pattern.exec(origin)) {
              return callback(null, true);
            }
          }
        }

        callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    cachedServer = serverless(expressApp);
  }

  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  const server = await bootstrap();
  return server(req, res);
}
