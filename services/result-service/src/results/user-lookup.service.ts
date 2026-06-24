import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface UserInfo {
  id: string;
  fullName: string;
  email: string;
  role: string;
  rollNumber?: string;
}

@Injectable()
export class UserLookupService {
  private readonly logger = new Logger(UserLookupService.name);
  private readonly userServiceUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.userServiceUrl = this.configService.get<string>('USER_SERVICE_URL', 'http://user-service:3001');
    this.apiKey = this.configService.get<string>('INTERNAL_API_KEY', '');
  }

  async getUserById(id: string): Promise<UserInfo> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<UserInfo>(
          `${this.userServiceUrl}/api/v1/internal/users/${id}`,
          { headers: { 'x-api-key': this.apiKey } },
        ),
      );
      return data;
    } catch (error: unknown) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'response' in error &&
        (error as { response?: { status?: number } }).response?.status === 404
      ) {
        throw new NotFoundException(`User ${id} not found`);
      }
      this.logger.error(`Failed to fetch user ${id}`, error);
      throw new ServiceUnavailableException('User service unavailable');
    }
  }
}
