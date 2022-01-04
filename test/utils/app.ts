import * as assert from 'assert';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TestingModule, Test } from '@nestjs/testing';
import * as nock from 'nock';

import { AppModule } from '../../src/app.module';
import { onApplicationStart } from './algoan.fake-server';

/**
 * Build a fake nest application
 */
export const buildFakeApp = async (): Promise<INestApplication> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app: INestApplication = moduleFixture.createNestApplication();
  const appStartMock: nock.Scope = onApplicationStart();

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

  await app.init();

  assert.strictEqual(appStartMock.isDone(), true);

  return app;
};
