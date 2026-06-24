import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

const mockUser: User = {
  id: 'uuid-1',
  fullName: 'Jane Doe',
  email: 'jane@example.com',
  password: '',
  role: UserRole.STUDENT,
  rollNumber: 'ROLL001',
  profilePicture: undefined,
  refreshToken: undefined,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            register: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            updateRefreshToken: jest.fn(),
            toResponseDto: jest.fn((u: User) => ({ ...u })),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed.jwt.token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_ACCESS_EXPIRY: '15m',
                JWT_REFRESH_EXPIRY: '7d',
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('should call usersService.register and return tokens', async () => {
      usersService.register.mockResolvedValue(mockUser);
      usersService.updateRefreshToken.mockResolvedValue();

      const result = await authService.register({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'SecureP@ss1',
        rollNumber: 'ROLL001',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(usersService.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        authService.login({ email: 'unknown@example.com', password: 'pass' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      usersService.findByEmail.mockResolvedValue({ ...mockUser, password: hashed });

      await expect(
        authService.login({ email: 'jane@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should return tokens for valid credentials', async () => {
      const hashed = await bcrypt.hash('SecureP@ss1', 10);
      usersService.findByEmail.mockResolvedValue({ ...mockUser, password: hashed });
      usersService.updateRefreshToken.mockResolvedValue();

      const result = await authService.login({
        email: 'jane@example.com',
        password: 'SecureP@ss1',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBe('signed.jwt.token');
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

      await expect(
        authService.refresh({ refreshToken: 'bad.token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should throw UnauthorizedException when stored token does not match', async () => {
      jwtService.verify.mockReturnValue({ sub: 'uuid-1', email: 'jane@example.com', role: 'STUDENT' });
      const differentHash = await bcrypt.hash('different.token', 10);
      usersService.findById.mockResolvedValue({ ...mockUser, refreshToken: differentHash });

      await expect(
        authService.refresh({ refreshToken: 'my.refresh.token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should return new tokens when refresh token matches', async () => {
      const token = 'my.refresh.token';
      const hashed = await bcrypt.hash(token, 10);
      jwtService.verify.mockReturnValue({ sub: 'uuid-1', email: 'jane@example.com', role: 'STUDENT' });
      usersService.findById.mockResolvedValue({ ...mockUser, refreshToken: hashed });
      usersService.updateRefreshToken.mockResolvedValue();

      const result = await authService.refresh({ refreshToken: token });
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('validateUser', () => {
    it('should return user for valid payload', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      const result = await authService.validateUser({ sub: 'uuid-1', email: 'jane@example.com', role: 'STUDENT' });
      expect(result).toEqual(mockUser);
    });

    it('should throw UnauthorizedException for unknown user id', async () => {
      usersService.findById.mockRejectedValue(new UnauthorizedException());
      await expect(
        authService.validateUser({ sub: 'unknown', email: 'x@x.com', role: 'STUDENT' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
