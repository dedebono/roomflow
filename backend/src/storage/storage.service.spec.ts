import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs and path
jest.mock('fs');
jest.mock('path');

// Mock uuid to avoid ESM parsing issues
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-12345'),
}));

describe('StorageService', () => {
  let service: StorageService;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock path.resolve to return predictable paths
    (path.resolve as jest.Mock).mockReturnValue('/mock/uploads');
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (path.extname as jest.Mock).mockReturnValue('.jpg');
    (path.basename as jest.Mock).mockReturnValue('test.jpg');
    (fs.existsSync as jest.Mock).mockReturnValue(true);

    // Mutable config mock — tests can override storageType per test
    const storageType = { value: 'LOCAL' };
    const configMock = {
      get: jest.fn((key: string) => {
        if (key === 'STORAGE_TYPE') return storageType.value;
        return null;
      }),
      _storageType: storageType,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    // Attach configMock to service so tests can change storage type
    (service as any).config = configMock;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStorageType', () => {
    it('should return the current storage type', () => {
      expect(service.getStorageType()).toBe('LOCAL');
    });
  });

  describe('setStorageType', () => {
    it('should update the storage type', () => {
      service.setStorageType('S3');
      expect(service.getStorageType()).toBe('S3');
    });
  });

  describe('upload', () => {
    it('should upload a file to local storage', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test data'),
      } as Express.Multer.File;

      const result = await service.upload(mockFile);

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(result).toMatch(/^\/uploads\//);
    });

    it('should throw for unimplemented storage types', async () => {
      const mockFile = {
        originalname: 'test.jpg',
        buffer: Buffer.from('test data'),
      } as Express.Multer.File;

      // Change storage type to S3 via the mutable config
      (service as any).config._storageType.value = 'S3';

      await expect(service.upload(mockFile)).rejects.toThrow(
        'Storage type not implemented',
      );
    });
  });

  describe('delete', () => {
    it('should delete a local file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await service.delete('/uploads/test.jpg');

      expect(fs.unlinkSync).toHaveBeenCalled();
    });

    it('should not delete files outside uploads directory', async () => {
      await service.delete('/etc/passwd');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should not fail if file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await service.delete('/uploads/test.jpg');

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
