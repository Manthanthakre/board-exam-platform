import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { SubjectMarks } from './subject-marks.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('results')
export class Result {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Index()
  @Column({ name: 'student_id' })
  studentId!: string;

  @ApiProperty()
  @Column({ name: 'exam_name' })
  examName!: string;

  @ApiProperty()
  @Column({ name: 'academic_year' })
  academicYear!: string;

  @ApiProperty()
  @Column({ name: 'total_marks', type: 'decimal', precision: 8, scale: 2 })
  totalMarks!: number;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage!: number;

  @ApiProperty({ type: () => [SubjectMarks] })
  @OneToMany(() => SubjectMarks, (sm) => sm.result, {
    cascade: true,
    eager: true,
  })
  subjectMarks!: SubjectMarks[];

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
