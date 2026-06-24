import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SubjectMarksDto {
  @ApiProperty({ example: 'Mathematics' })
  @IsString()
  @IsNotEmpty()
  subjectName!: string;

  @ApiProperty({ example: 87.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  marks!: number;
}

export class CreateResultDto {
  @ApiProperty({ example: 'uuid-of-student' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ example: '12th Board Exam 2024' })
  @IsString()
  @IsNotEmpty()
  examName!: string;

  @ApiProperty({ example: '2023-24' })
  @IsString()
  @IsNotEmpty()
  academicYear!: string;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  totalMarks!: number;

  @ApiProperty({ example: 87.4 })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage!: number;

  @ApiProperty({ type: [SubjectMarksDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectMarksDto)
  subjectMarks!: SubjectMarksDto[];
}

export class UpdateResultDto {
  @ApiPropertyOptional({ example: '12th Board Exam 2024 (Revised)' })
  @IsString()
  @IsNotEmpty()
  examName?: string;

  @ApiPropertyOptional({ example: '2023-24' })
  @IsString()
  @IsNotEmpty()
  academicYear?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsNumber()
  @Min(0)
  totalMarks?: number;

  @ApiPropertyOptional({ example: 90.0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiPropertyOptional({ type: [SubjectMarksDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubjectMarksDto)
  subjectMarks?: SubjectMarksDto[];
}
