/// <reference types="multer" />
import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseUUIDPipe,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiSecurity,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto, UserResponseDto } from './dto/user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from './entities/user.entity';
import { InternalApiKeyGuard } from '../auth/guards/internal-api-key.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Version('1')
  @Get('profile')
  @ApiOperation({ summary: 'Get own profile' })
  getProfile(@CurrentUser() user: User): UserResponseDto {
    return this.usersService.toResponseDto(user);
  }

  @Version('1')
  @Put('profile')
  @ApiOperation({ summary: 'Update own profile' })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return this.usersService.toResponseDto(updated);
  }

  @Version('1')
  @Post('profile/upload-image')
  @ApiOperation({ summary: 'Upload profile picture to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /image\/(jpeg|png|webp)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.uploadProfilePicture(user.id, file);
    return this.usersService.toResponseDto(updated);
  }

  // Internal service-to-service endpoint
  @Version('1')
  @Get('internal/users/:id')
  @Public()
  @UseGuards(InternalApiKeyGuard)
  @ApiSecurity('internal-api-key')
  @ApiOperation({ summary: '[Internal] Look up user by ID' })
  async findUserById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(id);
    return this.usersService.toResponseDto(user);
  }
}
