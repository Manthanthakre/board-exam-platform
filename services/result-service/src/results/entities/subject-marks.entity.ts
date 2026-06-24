import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Result } from './result.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('subject_marks')
export class SubjectMarks {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({ name: 'subject_name' })
  subjectName!: string;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 6, scale: 2 })
  marks!: number;

  @ManyToOne(() => Result, (result) => result.subjectMarks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'result_id' })
  result!: Result;

  @Column({ name: 'result_id' })
  resultId!: string;
}
