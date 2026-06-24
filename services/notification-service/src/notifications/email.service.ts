import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface SubjectMark {
  subjectName: string;
  marks: number;
}

export interface EmailPayload {
  to: string;
  studentName: string;
  examName: string;
  academicYear: string;
  percentage: number;
  subjectMarks: SubjectMark[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.maxRetries = this.configService.get<number>('MAX_RETRIES', 3);
    this.baseDelay = this.configService.get<number>('RETRY_BASE_DELAY_MS', 1000);
    this.from = this.configService.get<string>('SMTP_FROM', 'noreply@boardexam.com');

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.ethereal.email'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER', ''),
        pass: this.configService.get<string>('SMTP_PASS', ''),
      },
    });
  }

  /**
   * Sends an email with exponential backoff retry on failure.
   * Returns the number of attempts made.
   * Throws after exhausting all retries.
   */
  async sendResultEmail(payload: EmailPayload): Promise<number> {
    let attempts = 0;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      attempts = attempt;
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: payload.to,
          subject: 'Your Board Exam Results',
          html: this.buildEmailHtml(payload),
          text: this.buildEmailText(payload),
        });
        this.logger.log(`Email sent to ${payload.to} on attempt ${attempt}`);
        return attempts;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `Email attempt ${attempt}/${this.maxRetries} failed for ${payload.to}: ${lastError.message}`,
        );

        if (attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, …
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Email sending failed after all retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildEmailHtml(payload: EmailPayload): string {
    const subjectRows = payload.subjectMarks
      .map(
        (s) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;">${s.subjectName}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e0e0e0;text-align:center;font-weight:600;">${s.marks}</td>
        </tr>`,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8" /></head>
      <body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
        <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <div style="background:#1a237e;padding:24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">Board Exam Results</h1>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;color:#333;">Dear <strong>${payload.studentName}</strong>,</p>
            <p style="color:#555;">Your results for <strong>${payload.examName}</strong> (${payload.academicYear}) are now available.</p>

            <table style="width:100%;border-collapse:collapse;margin:24px 0;">
              <thead>
                <tr style="background:#e8eaf6;">
                  <th style="padding:10px 12px;text-align:left;color:#1a237e;">Subject</th>
                  <th style="padding:10px 12px;text-align:center;color:#1a237e;">Marks</th>
                </tr>
              </thead>
              <tbody>${subjectRows}</tbody>
            </table>

            <div style="background:#e8f5e9;border-left:4px solid #43a047;padding:16px;border-radius:4px;margin-top:16px;">
              <p style="margin:0;font-size:18px;color:#2e7d32;">
                Overall Percentage: <strong>${payload.percentage}%</strong>
              </p>
            </div>

            <p style="margin-top:32px;color:#777;font-size:13px;">
              This is an automated message from the Board Exam Platform. Please do not reply.
            </p>
          </div>
        </div>
      </body>
      </html>`;
  }

  private buildEmailText(payload: EmailPayload): string {
    const subjectLines = payload.subjectMarks
      .map((s) => `  ${s.subjectName}: ${s.marks}`)
      .join('\n');

    return [
      `Dear ${payload.studentName},`,
      '',
      `Your results for ${payload.examName} (${payload.academicYear}) are now available.`,
      '',
      'Subject-wise Marks:',
      subjectLines,
      '',
      `Overall Percentage: ${payload.percentage}%`,
      '',
      'This is an automated message. Please do not reply.',
    ].join('\n');
  }
}
