import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotificationsService, ResultViewedEvent } from './notifications.service';
import { EmailLog, EmailStatus } from './schemas/email-log.schema';
import { EmailService } from './email.service';

const mockEvent: ResultViewedEvent = {
  studentId: 'student-uuid-1',
  email: 'student@test.com',
  studentName: 'Jane Doe',
  resultData: [
    {
      examName: '12th Board Exam',
      academicYear: '2023-24',
      percentage: 87.4,
      subjectMarks: [{ subjectName: 'Mathematics', marks: 90 }],
    },
  ],
  timestamp: new Date().toISOString(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let emailService: jest.Mocked<EmailService>;
  let mockModel: {
    create: jest.Mock;
    find: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };

  beforeEach(async () => {
    const mockDoc = { _id: 'log-id-1', ...mockEvent, status: EmailStatus.PENDING };

    mockModel = {
      create: jest.fn().mockResolvedValue(mockDoc),
      find: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([mockDoc]),
        }),
      }),
      findByIdAndUpdate: jest.fn().mockResolvedValue(mockDoc),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(EmailLog.name),
          useValue: mockModel,
        },
        {
          provide: EmailService,
          useValue: {
            sendResultEmail: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    emailService = module.get(EmailService);
  });

  describe('handleResultViewed', () => {
    it('should create a PENDING log and send email on success', async () => {
      await service.handleResultViewed(mockEvent);

      expect(mockModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: mockEvent.studentId,
          email: mockEvent.email,
          status: EmailStatus.PENDING,
        }),
      );
      expect(emailService.sendResultEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockEvent.email,
          studentName: mockEvent.studentName,
        }),
      );
      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'log-id-1',
        expect.objectContaining({ status: EmailStatus.SENT }),
      );
    });

    it('should mark log as FAILED when email sending throws', async () => {
      emailService.sendResultEmail.mockRejectedValue(new Error('SMTP timeout'));

      await service.handleResultViewed(mockEvent);

      expect(mockModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'log-id-1',
        expect.objectContaining({
          status: EmailStatus.FAILED,
          error: 'SMTP timeout',
        }),
      );
    });

    it('should not throw even when email service fails completely', async () => {
      emailService.sendResultEmail.mockRejectedValue(new Error('Fatal error'));
      await expect(service.handleResultViewed(mockEvent)).resolves.toBeUndefined();
    });

    it('should return early when resultData array is empty', async () => {
      await service.handleResultViewed({ ...mockEvent, resultData: [] });
      expect(mockModel.create).not.toHaveBeenCalled();
      expect(emailService.sendResultEmail).not.toHaveBeenCalled();
    });
  });

  describe('getLogsByStudentId', () => {
    it('should return logs for a given studentId sorted by createdAt desc', async () => {
      const logs = await service.getLogsByStudentId('student-uuid-1');
      expect(logs).toHaveLength(1);
      expect(mockModel.find).toHaveBeenCalledWith({ studentId: 'student-uuid-1' });
    });
  });
});
