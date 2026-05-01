import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskResolution20260501001000 implements MigrationInterface {
  name = 'AddTaskResolution20260501001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tasks ADD resolution text NULL AFTER description');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tasks DROP COLUMN resolution');
  }
}
