import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('Health Endpoint Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /health', () => {
    it('should return HTTP 200 with status ok, uptime, and timestamp without authentication', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toBeDefined();
      expect(response.body.status).toBe('ok');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof response.body.timestamp).toBe('string');
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should be strictly minimal and never expose secrets, environment variables, or database credentials', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const keys = Object.keys(response.body).sort();
      expect(keys).toEqual(['status', 'timestamp', 'uptime'].sort());
      expect(response.body.env).toBeUndefined();
      expect(response.body.databaseUrl).toBeUndefined();
      expect(response.body.DATABASE_URL).toBeUndefined();
      expect(response.body.jwtSecret).toBeUndefined();
      expect(response.body.JWT_SECRET).toBeUndefined();
      expect(response.body.credentials).toBeUndefined();
    });

    it('should respond to GET /api/health with the same health contract', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body.status).toBe('ok');
      expect(typeof response.body.uptime).toBe('number');
      expect(typeof response.body.timestamp).toBe('string');
    });
  });
});
