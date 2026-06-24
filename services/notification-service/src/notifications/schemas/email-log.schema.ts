import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ApiProperty } from '@nestjs/swagger';

export type EmailLogDocument = EmailLog & Document;

export enum EmailStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

@Schema({ collection: 'email_logs', timestamps: { createdAt: 'createdAt', updatedAt: false } })
export class EmailLog {
  @ApiProperty()
  @Prop({ required: true, index: true })
  studentId!: string;

  @ApiProperty()
  @Prop({ required: true })
  email!: string;

  @ApiProperty({ enum: EmailStatus })
  @Prop({ type: String, enum: EmailStatus, default: EmailStatus.PENDING })
  status!: EmailStatus;

  @ApiProperty()
  @Prop()
  message!: string;

  @ApiProperty({ nullable: true })
  @Prop()
  error?: string;

  @ApiProperty()
  @Prop({ default: 0 })
  attempts!: number;

  @ApiProperty()
  @Prop()
  createdAt!: Date;
}

export const EmailLogSchema = SchemaFactory.createForClass(EmailLog);
