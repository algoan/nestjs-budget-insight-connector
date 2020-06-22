import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Bootstrap method
 */
const bootstrap = async (): Promise<void> => {
  const port: number = 3000;
  const app: INestApplication = await NestFactory.create(AppModule, {
    logger: false,
  });

  /**
   * Attach global dependencies
   */
  app.useGlobalPipes(
    new ValidationPipe({
      /**
       * If set to true, validator will strip validated (returned)
       * object of any properties that do not use any validation decorators.
       */
      whitelist: true,
    }),
  );

  await app.listen(port);
};
bootstrap().catch((err: Error): void => {
  // eslint-disable-next-line
  console.error(`An error occurred when bootstrapping the application`, err);
  process.exit(1);
});
