import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  EmailLog,
  EmailLogDocument,
  EmailStatus,
} from './schemas/email-log.schema';
import { EmailService, SubjectMark } from './email.service';

export interface ResultViewedEvent {
  studentId: string;
  email: string;
  studentName: string;
  resultData: Array<{
    examName: string;
    academicYear: string;
    percentage: number;
    subjectMarks: SubjectMark[];
  }>;
  timestamp: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(EmailLog.name)
    private readonly emailLogModel: Model<EmailLogDocument>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Processes a result.viewed event:
   *  1. Persists an initial PENDING log.
   *  2. Attempts to send email (with retry inside EmailService).
   *  3. Updates the log to SENT or FAILED.
   *  Never throws — failures are fully logged.
   */
  async handleResultViewed(event: ResultViewedEvent): Promise<void> {
    const firstResult = event.resultData[0];
    if (!firstResult) {
      this.logger.warn(`No result data in event for student ${event.studentId}`);
      return;
    }

    // Create an initial log entry
    const log = await this.emailLogModel.create({
      studentId: event.studentId,
      email: event.email,
      status: EmailStatus.PENDING,
      message: `Result notification for ${firstResult.examName}`,
      attempts: 0,
    });

    try {
      const attempts = await this.emailService.sendResultEmail({
        to: event.email,
        studentName: event.studentName,
        examName: firstResult.examName,
        academicYear: firstResult.academicYear,
        percentage: firstResult.percentage,
        subjectMarks: firstResult.subjectMarks,
      });

      await this.emailLogModel.findByIdAndUpdate(log._id, {
        status: EmailStatus.SENT,
        attempts,
      });

      this.logger.log(`Email delivered to ${event.email} for student ${event.studentId}`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to deliver email to ${event.email} for student ${event.studentId}: ${errMsg}`,
      );

      await this.emailLogModel.findByIdAndUpdate(log._id, {
        status: EmailStatus.FAILED,
        error: errMsg,
        attempts: 3, // MAX_RETRIES exhausted
      });
    }
  }

  async getLogsByStudentId(studentId: string): Promise<EmailLogDocument[]> {
    return this.emailLogModel
      .find({ studentId })
      .sort({ createdAt: -1 })
      .exec();
  }
}
