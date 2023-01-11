import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AlgoanService } from './algoan/services/algoan.service';
import { ConfigModule } from './config/config.module';
import { AlgoanServiceAcountService } from './algoan/services/algoan-service-account.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      controllers: [AppController],
      providers: [AppService, AlgoanService, AlgoanServiceAcountService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getPing()).toBe('ok');
    });
  });
});
