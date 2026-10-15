import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200);
  });

  it('/auth/hospitals (GET) - returns public hospitals without authentication', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/hospitals')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('/api/auth/hospitals (GET) - supports proxy prefix compatibility', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/hospitals')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
