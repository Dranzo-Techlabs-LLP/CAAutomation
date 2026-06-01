import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AutomationRules20260501001100 implements MigrationInterface {
  name = 'AutomationRules20260501001100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'automation_rules',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'firm_id', type: 'varchar', length: '36' },
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'events', type: 'json' },
          { name: 'conditions', type: 'json' },
          { name: 'actions', type: 'json' },
          { name: 'priority', type: 'int', default: 0 },
          { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
          { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
          { name: 'deleted_at', type: 'datetime', precision: 6, isNullable: true },
          { name: 'created_by', type: 'varchar', length: '36', isNullable: true },
          { name: 'updated_by', type: 'varchar', length: '36', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'automation_rules',
      new TableIndex({ columnNames: ['firm_id', 'is_active'], name: 'IDX_automation_rules_firm_active' }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('automation_rules', true);
  }
}
