import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Bootstrap method
 */
const bootstrap = async (): Promise<void> => {
  const port: number = 3000;
  const app: INestApplication = await NestFactory.create(AppModule);
  await app.listen(port);
};
bootstrap().catch((err: Error): void => {
  // eslint-disable-next-line
  console.error(`An error occurred when bootstrapping the application`, err);
  process.exit(1);
});
