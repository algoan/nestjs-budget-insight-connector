import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { buildFakeApp } from './utils/app';
import * as nock from 'nock';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await buildFakeApp();
  });

  afterAll(async () => {
    nock.restore();
    await app.close();
  });

  it('/ (GET)', () => request(app.getHttpServer()).get('/ping').expect(204).expect({}));
});
