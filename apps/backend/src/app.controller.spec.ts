import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return status ok with uptime and timestamp', () => {
      const res = appController.getHealth();
      expect(res.status).toBe('ok');
      expect(typeof res.uptime).toBe('number');
      expect(res.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof res.timestamp).toBe('string');
      expect(new Date(res.timestamp).toISOString()).toBe(res.timestamp);
    });

    it('should not expose environment variables, secrets, or sensitive details', () => {
      const res = appController.getHealth();
      const keys = Object.keys(res).sort();
      expect(keys).toEqual(['status', 'timestamp', 'uptime'].sort());
      expect((res as Record<string, unknown>).env).toBeUndefined();
      expect((res as Record<string, unknown>).databaseUrl).toBeUndefined();
      expect((res as Record<string, unknown>).jwtSecret).toBeUndefined();
      expect((res as Record<string, unknown>).secret).toBeUndefined();
      expect((res as Record<string, unknown>).password).toBeUndefined();
    });
  });
});
