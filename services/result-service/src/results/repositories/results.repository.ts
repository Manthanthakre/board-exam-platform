import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Result } from '../entities/result.entity';

@Injectable()
export class ResultsRepository {
  constructor(
    @InjectRepository(Result)
    private readonly repo: Repository<Result>,
  ) {}

  async findAll(): Promise<Result[]> {
    return this.repo.find({ relations: ['subjectMarks'], order: { createdAt: 'DESC' } });
  }

  async findByStudentId(studentId: string): Promise<Result[]> {
    return this.repo.find({
      where: { studentId },
      relations: ['subjectMarks'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Result | null> {
    return this.repo.findOne({ where: { id }, relations: ['subjectMarks'] });
  }

  async create(data: Partial<Result>): Promise<Result> {
    const result = this.repo.create(data);
    return this.repo.save(result);
  }

  async update(id: string, data: Partial<Result>): Promise<Result | null> {
    await this.repo.save({ ...data, id });
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
