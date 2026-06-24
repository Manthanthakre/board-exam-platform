import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { Result } from '../results/entities/result.entity';
import { SubjectMarks } from '../results/entities/subject-marks.entity';

dotenv.config();

export const typeOrmConfig = (cs: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: cs.get<string>('DB_HOST', 'localhost'),
  port: cs.get<number>('DB_PORT', 5432),
  username: cs.get<string>('DB_USERNAME', 'result_admin'),
  password: cs.get<string>('DB_PASSWORD', 'result_secret'),
  database: cs.get<string>('DB_NAME', 'result_db'),
  entities: [Result, SubjectMarks],
  migrations: [__dirname + '/../migrations/*.{js,ts}'],
  migrationsRun: true,
  synchronize: false,
  logging: cs.get<string>('NODE_ENV') === 'development',
});

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'result_admin',
  password: process.env['DB_PASSWORD'] ?? 'result_secret',
  database: process.env['DB_NAME'] ?? 'result_db',
  entities: [Result, SubjectMarks],
  migrations: [__dirname + '/../migrations/*.{js,ts}'],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
