import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Result } from './entities/result.entity';
import { SubjectMarks } from './entities/subject-marks.entity';
import { ResultsService } from './results.service';
import { ResultsController } from './results.controller';
import { ResultsRepository } from './repositories/results.repository';
import { UserLookupService } from './user-lookup.service';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Result, SubjectMarks]),
    HttpModule,
    RabbitMQModule,
  ],
  providers: [ResultsService, ResultsRepository, UserLookupService],
  controllers: [ResultsController],
})
export class ResultsModule {}
