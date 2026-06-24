import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  STUDENT = 'STUDENT',
  MODERATOR = 'MODERATOR',
}

@Entity('users')
export class User {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({ name: 'full_name' })
  fullName!: string;

  @ApiProperty()
  @Index({ unique: true })
  @Column({ unique: true })
  email!: string;

  @Exclude()
  @Column()
  password!: string;

  @ApiProperty({ enum: UserRole })
  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role!: UserRole;

  @ApiProperty({ nullable: true })
  @Index({ unique: true, where: '"roll_number" IS NOT NULL' })
  @Column({ name: 'roll_number', nullable: true, unique: false })
  rollNumber?: string;

  @ApiProperty({ nullable: true })
  @Column({ name: 'profile_picture', nullable: true })
  profilePicture?: string;

  @Exclude()
  @Column({ name: 'refresh_token', nullable: true })
  refreshToken?: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
