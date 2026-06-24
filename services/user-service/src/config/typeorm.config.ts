import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from '../users/entities/user.entity';

dotenv.config();

export const typeOrmConfig = (cs: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: cs.get<string>('DB_HOST', 'localhost'),
  port: cs.get<number>('DB_PORT', 5432),
  username: cs.get<string>('DB_USERNAME', 'user_admin'),
  password: cs.get<string>('DB_PASSWORD', 'user_secret'),
  database: cs.get<string>('DB_NAME', 'user_db'),
  entities: [User],
  migrations: [__dirname + '/../migrations/*.{js,ts}'],
  migrationsRun: true,
  synchronize: false,
  logging: cs.get<string>('NODE_ENV') === 'development',
});

// Used by TypeORM CLI
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  username: process.env['DB_USERNAME'] ?? 'user_admin',
  password: process.env['DB_PASSWORD'] ?? 'user_secret',
  database: process.env['DB_NAME'] ?? 'user_db',
  entities: [User],
  migrations: [__dirname + '/../migrations/*.{js,ts}'],
  synchronize: false,
};

export default new DataSource(dataSourceOptions);
