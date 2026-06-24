/// <reference types="multer" />
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from './entities/user.entity';
import { UsersRepository } from './repositories/users.repository';
import { RegisterDto, UpdateProfileDto, UserResponseDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly configService: ConfigService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async register(dto: RegisterDto): Promise<User> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already registered');

    if (dto.role === UserRole.STUDENT || !dto.role) {
      if (!dto.rollNumber) throw new BadRequestException('Roll number is required for students');
      const existingRoll = await this.usersRepository.findByRollNumber(dto.rollNumber);
      if (existingRoll) throw new ConflictException('Roll number already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 12);
    return this.usersRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      password: hashed,
      role: dto.role ?? UserRole.STUDENT,
      rollNumber: dto.rollNumber,
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);
    if (dto.rollNumber && dto.rollNumber !== user.rollNumber) {
      const existing = await this.usersRepository.findByRollNumber(dto.rollNumber);
      if (existing) throw new ConflictException('Roll number already in use');
    }
    const updated = await this.usersRepository.update(id, dto);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    const hashed = refreshToken ? await bcrypt.hash(refreshToken, 12) : undefined;
    await this.usersRepository.update(id, { refreshToken: hashed });
  }

  async uploadProfilePicture(id: string, file: Express.Multer.File): Promise<User> {
    const user = await this.findById(id);

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'board-exam/profiles',
          public_id: `user_${id}`,
          overwrite: true,
          transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
        },
        (err: UploadApiErrorResponse | undefined, res: UploadApiResponse | undefined) => {
          if (err || !res) return reject(err ?? new Error('Upload failed'));
          resolve(res);
        },
      );
      stream.end(file.buffer);
    });

    user.profilePicture = result.secure_url;
    return this.usersRepository.save(user);
  }

  toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      rollNumber: user.rollNumber,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
