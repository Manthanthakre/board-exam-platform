import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService, EmailPayload } from './email.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

const mockPayload: EmailPayload = {
  to: 'student@test.com',
  studentName: 'Jane Doe',
  examName: '12th Board Exam',
  academicYear: '2023-24',
  percentage: 87.4,
  subjectMarks: [
    { subjectName: 'Mathematics', marks: 90 },
    { subjectName: 'Physics', marks: 85 },
  ],
};

describe('EmailService', () => {
  let service: EmailService;
  let mockSendMail: jest.Mock;

  beforeEach(async () => {
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-message-id' });

    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: unknown) => {
              const map: Record<string, unknown> = {
                MAX_RETRIES: 3,
                RETRY_BASE_DELAY_MS: 10, // short delay for tests
                SMTP_FROM: 'noreply@boardexam.com',
                SMTP_HOST: 'smtp.test.com',
                SMTP_PORT: 587,
                SMTP_SECURE: 'false',
                SMTP_USER: 'user',
                SMTP_PASS: 'pass',
              };
              return map[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe('sendResultEmail', () => {
    it('should send email successfully on first attempt', async () => {
      const attempts = await service.sendResultEmail(mockPayload);
      expect(attempts).toBe(1);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockPayload.to,
          subject: 'Your Board Exam Results',
        }),
      );
    });

    it('should retry on failure and succeed on 2nd attempt', async () => {
      mockSendMail
        .mockRejectedValueOnce(new Error('SMTP error'))
        .mockResolvedValueOnce({ messageId: 'ok' });

      const attempts = await service.sendResultEmail(mockPayload);
      expect(attempts).toBe(2);
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting all retries', async () => {
      mockSendMail.mockRejectedValue(new Error('Persistent SMTP failure'));

      await expect(service.sendResultEmail(mockPayload)).rejects.toThrow(
        'Persistent SMTP failure',
      );
      expect(mockSendMail).toHaveBeenCalledTimes(3); // MAX_RETRIES = 3
    });

    it('should include student name in email HTML', async () => {
      await service.sendResultEmail(mockPayload);
      const callArgs = mockSendMail.mock.calls[0][0] as { html: string };
      expect(callArgs.html).toContain('Jane Doe');
      expect(callArgs.html).toContain('12th Board Exam');
      expect(callArgs.html).toContain('87.4%');
    });

    it('should include all subject marks in email text', async () => {
      await service.sendResultEmail(mockPayload);
      const callArgs = mockSendMail.mock.calls[0][0] as { text: string };
      expect(callArgs.text).toContain('Mathematics');
      expect(callArgs.text).toContain('Physics');
    });
  });
});
