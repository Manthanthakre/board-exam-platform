import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ResultsService, AuthUser } from './results.service';
import { ResultsRepository } from './repositories/results.repository';
import { UserLookupService } from './user-lookup.service';
import { RabbitMQProducer } from '../rabbitmq/rabbitmq.producer';
import { Result } from './entities/result.entity';

const mockResult: Result = {
  id: 'result-uuid-1',
  studentId: 'student-uuid-1',
  examName: '12th Board Exam',
  academicYear: '2023-24',
  totalMarks: 500,
  percentage: 87.4,
  subjectMarks: [
    { id: 'sm-1', subjectName: 'Math', marks: 90, resultId: 'result-uuid-1', result: {} as Result },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const moderator: AuthUser = { id: 'mod-uuid', email: 'mod@test.com', role: 'MODERATOR' };
const student: AuthUser = { id: 'student-uuid-1', email: 'stu@test.com', role: 'STUDENT' };
const otherStudent: AuthUser = { id: 'other-uuid', email: 'other@test.com', role: 'STUDENT' };

describe('ResultsService', () => {
  let service: ResultsService;
  let repo: jest.Mocked<ResultsRepository>;
  let userLookup: jest.Mocked<UserLookupService>;
  let producer: jest.Mocked<RabbitMQProducer>;
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    cache = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsService,
        {
          provide: ResultsRepository,
          useValue: {
            findAll: jest.fn(),
            findByStudentId: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: UserLookupService,
          useValue: {
            getUserById: jest.fn().mockResolvedValue({
              id: 'student-uuid-1',
              fullName: 'Jane Doe',
              email: 'stu@test.com',
              role: 'STUDENT',
            }),
          },
        },
        {
          provide: RabbitMQProducer,
          useValue: { publishResultViewed: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: CACHE_MANAGER, useValue: cache },
      ],
    }).compile();

    service = module.get<ResultsService>(ResultsService);
    repo = module.get(ResultsRepository);
    userLookup = module.get(UserLookupService);
    producer = module.get(RabbitMQProducer);
  });

  describe('create', () => {
    it('should create a result after verifying student exists', async () => {
      repo.create.mockResolvedValue(mockResult);
      const result = await service.create({
        studentId: 'student-uuid-1',
        examName: '12th Board Exam',
        academicYear: '2023-24',
        totalMarks: 500,
        percentage: 87.4,
        subjectMarks: [{ subjectName: 'Math', marks: 90 }],
      });
      expect(result).toEqual(mockResult);
      expect(userLookup.getUserById).toHaveBeenCalledWith('student-uuid-1');
    });

    it('should propagate NotFoundException if student does not exist', async () => {
      userLookup.getUserById.mockRejectedValue(new NotFoundException());
      await expect(
        service.create({
          studentId: 'missing',
          examName: 'X',
          academicYear: '2024',
          totalMarks: 100,
          percentage: 50,
          subjectMarks: [{ subjectName: 'Math', marks: 50 }],
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if result not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('missing-id', { examName: 'X' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should update and return result', async () => {
      repo.findById.mockResolvedValue(mockResult);
      const updated = { ...mockResult, examName: 'Updated Exam' };
      repo.update.mockResolvedValue(updated);
      const result = await service.update('result-uuid-1', { examName: 'Updated Exam' });
      expect(result.examName).toBe('Updated Exam');
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException if result does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.delete('missing-id')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should delete an existing result', async () => {
      repo.findById.mockResolvedValue(mockResult);
      repo.delete.mockResolvedValue();
      await expect(service.delete('result-uuid-1')).resolves.toBeUndefined();
    });
  });

  describe('findOwnResults', () => {
    it('should return student results and publish event', async () => {
      repo.findByStudentId.mockResolvedValue([mockResult]);
      const results = await service.findOwnResults(student);
      expect(results).toHaveLength(1);
      expect(producer.publishResultViewed).toHaveBeenCalled();
    });

    it('should return cached results without extra DB call', async () => {
      cache.get.mockResolvedValue([mockResult]);
      const results = await service.findOwnResults(student);
      expect(results).toHaveLength(1);
      expect(repo.findByStudentId).not.toHaveBeenCalled();
    });
  });

  describe('findByStudentId', () => {
    it('should throw ForbiddenException when student requests another student results', async () => {
      await expect(
        service.findByStudentId('other-student-id', otherStudent),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow moderator to view any student results', async () => {
      repo.findByStudentId.mockResolvedValue([mockResult]);
      const results = await service.findByStudentId('student-uuid-1', moderator);
      expect(results).toHaveLength(1);
    });
  });
});
