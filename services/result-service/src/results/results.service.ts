import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { ResultsRepository } from './repositories/results.repository';
import { UserLookupService } from './user-lookup.service';
import { RabbitMQProducer } from '../rabbitmq/rabbitmq.producer';
import { CreateResultDto, UpdateResultDto } from './dto/result.dto';
import { Result } from './entities/result.entity';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

const CACHE_PREFIX = 'results';

@Injectable()
export class ResultsService {
  constructor(
    private readonly resultsRepository: ResultsRepository,
    private readonly userLookupService: UserLookupService,
    private readonly rabbitMQProducer: RabbitMQProducer,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async create(dto: CreateResultDto): Promise<Result> {
    // Verify student exists
    await this.userLookupService.getUserById(dto.studentId);

    const result = await this.resultsRepository.create({
      studentId: dto.studentId,
      examName: dto.examName,
      academicYear: dto.academicYear,
      totalMarks: dto.totalMarks,
      percentage: dto.percentage,
      subjectMarks: dto.subjectMarks as never,
    });

    await this.invalidateCache(dto.studentId);
    return result;
  }

  async update(id: string, dto: UpdateResultDto): Promise<Result> {
    const existing = await this.resultsRepository.findById(id);
    if (!existing) throw new NotFoundException('Result not found');

    const updated = await this.resultsRepository.update(id, {
      ...dto,
      subjectMarks: dto.subjectMarks as never,
    });
    if (!updated) throw new NotFoundException('Result not found');

    await this.invalidateCache(existing.studentId);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.resultsRepository.findById(id);
    if (!existing) throw new NotFoundException('Result not found');
    await this.resultsRepository.delete(id);
    await this.invalidateCache(existing.studentId);
  }

  async findAll(): Promise<Result[]> {
    const cached = await this.cacheManager.get<Result[]>(`${CACHE_PREFIX}:all`);
    if (cached) return cached;

    const results = await this.resultsRepository.findAll();
    await this.cacheManager.set(`${CACHE_PREFIX}:all`, results);
    return results;
  }

  async findOwnResults(user: AuthUser): Promise<Result[]> {
    const cacheKey = `${CACHE_PREFIX}:student:${user.id}`;
    const cached = await this.cacheManager.get<Result[]>(cacheKey);
    if (cached) {
      // Publish event for cached result too
      await this.publishResultViewedEvent(user, cached);
      return cached;
    }

    const results = await this.resultsRepository.findByStudentId(user.id);
    await this.cacheManager.set(cacheKey, results);
    await this.publishResultViewedEvent(user, results);
    return results;
  }

  async findByStudentId(studentId: string, requestingUser: AuthUser): Promise<Result[]> {
    // Students can only see their own results
    if (requestingUser.role === 'STUDENT' && requestingUser.id !== studentId) {
      throw new ForbiddenException('Access denied');
    }

    const cacheKey = `${CACHE_PREFIX}:student:${studentId}`;
    const cached = await this.cacheManager.get<Result[]>(cacheKey);
    if (cached) return cached;

    const results = await this.resultsRepository.findByStudentId(studentId);
    await this.cacheManager.set(cacheKey, results);
    return results;
  }

  private async publishResultViewedEvent(user: AuthUser, results: Result[]): Promise<void> {
    if (results.length === 0) return;

    try {
      let userInfo;
      try {
        userInfo = await this.userLookupService.getUserById(user.id);
      } catch {
        userInfo = { fullName: 'Unknown', email: user.email };
      }

      await this.rabbitMQProducer.publishResultViewed({
        studentId: user.id,
        email: user.email,
        studentName: userInfo.fullName,
        resultData: results,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Non-blocking: log but do not fail the request
      console.error('Failed to publish result.viewed event', error);
    }
  }

  private async invalidateCache(studentId: string): Promise<void> {
    await this.cacheManager.del(`${CACHE_PREFIX}:all`);
    await this.cacheManager.del(`${CACHE_PREFIX}:student:${studentId}`);
  }
}
