import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1700000000000 implements MigrationInterface {
  name = 'CreateUsersTable1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "users_role_enum" AS ENUM ('STUDENT', 'MODERATOR')
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"              UUID              NOT NULL DEFAULT gen_random_uuid(),
        "full_name"       VARCHAR           NOT NULL,
        "email"           VARCHAR           NOT NULL,
        "password"        VARCHAR           NOT NULL,
        "role"            "users_role_enum" NOT NULL DEFAULT 'STUDENT',
        "roll_number"     VARCHAR,
        "profile_picture" VARCHAR,
        "refresh_token"   VARCHAR,
        "created_at"      TIMESTAMP         NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_users_roll_number"
        ON "users" ("roll_number")
        WHERE "roll_number" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_users_roll_number"`);
    await queryRunner.query(`DROP INDEX "UQ_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "users_role_enum"`);
  }
}
