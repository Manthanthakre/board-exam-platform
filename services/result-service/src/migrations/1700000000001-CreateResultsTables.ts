import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateResultsTables1700000000001 implements MigrationInterface {
  name = 'CreateResultsTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "results" (
        "id"            UUID             NOT NULL DEFAULT gen_random_uuid(),
        "student_id"    VARCHAR          NOT NULL,
        "exam_name"     VARCHAR          NOT NULL,
        "academic_year" VARCHAR          NOT NULL,
        "total_marks"   DECIMAL(8,2)     NOT NULL,
        "percentage"    DECIMAL(5,2)     NOT NULL,
        "created_at"    TIMESTAMP        NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMP        NOT NULL DEFAULT now(),
        CONSTRAINT "PK_results_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_results_student_id" ON "results" ("student_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "subject_marks" (
        "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
        "subject_name" VARCHAR      NOT NULL,
        "marks"        DECIMAL(6,2) NOT NULL,
        "result_id"    UUID         NOT NULL,
        CONSTRAINT "PK_subject_marks_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subject_marks_result"
          FOREIGN KEY ("result_id")
          REFERENCES "results" ("id")
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "subject_marks"`);
    await queryRunner.query(`DROP INDEX "IDX_results_student_id"`);
    await queryRunner.query(`DROP TABLE "results"`);
  }
}
