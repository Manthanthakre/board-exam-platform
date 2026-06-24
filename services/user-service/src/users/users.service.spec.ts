import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersRepository } from './repositories/users.repository';
import { User, UserRole } from './entities/user.entity';

const mockUser: User = {
  id: 'uuid-1',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  password: '$2b$12$hashedpassword',
  role: UserRole.STUDENT,
  rollNumber: 'ROLL001',
  profilePicture: undefined,
  refreshToken: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findById: jest.fn(),
            findByEmail: jest.fn(),
            findByRollNumber: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repo = module.get(UsersRepository);
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      repo.findByEmail.mockResolvedValue(mockUser);
      await expect(
        service.register({ fullName: 'Jane', email: 'jane@example.com', password: 'pass12345', rollNumber: 'ROLL002' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should throw ConflictException if roll number taken', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.findByRollNumber.mockResolvedValue(mockUser);
      await expect(
        service.register({ fullName: 'Bob', email: 'bob@example.com', password: 'pass12345', rollNumber: 'ROLL001' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('should create and return user on success', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.findByRollNumber.mockResolvedValue(null);
      repo.create.mockResolvedValue(mockUser);

      const result = await service.register({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'SecureP@ss1',
        rollNumber: 'ROLL001',
      });

      expect(result).toEqual(mockUser);
      expect(repo.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      repo.findById.mockResolvedValue(mockUser);
      const result = await service.findById('uuid-1');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should update and return updated user', async () => {
      repo.findById.mockResolvedValue(mockUser);
      const updated = { ...mockUser, fullName: 'Jane Updated' };
      repo.update.mockResolvedValue(updated);

      const result = await service.updateProfile('uuid-1', { fullName: 'Jane Updated' });
      expect(result.fullName).toBe('Jane Updated');
    });

    it('should throw ConflictException if new rollNumber is taken', async () => {
      repo.findById.mockResolvedValue(mockUser);
      repo.findByRollNumber.mockResolvedValue({ ...mockUser, id: 'other-uuid' });

      await expect(
        service.updateProfile('uuid-1', { rollNumber: 'TAKEN001' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('toResponseDto', () => {
    it('should not include password or refreshToken', () => {
      const dto = service.toResponseDto(mockUser);
      expect(dto).not.toHaveProperty('password');
      expect(dto).not.toHaveProperty('refreshToken');
      expect(dto).toHaveProperty('id');
      expect(dto).toHaveProperty('email');
    });
  });
});
