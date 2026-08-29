import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateMerchantInsight1703000000009 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'merchant_insights',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'summary',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'insights',
            type: 'jsonb',
            isNullable: false,
            default: `'[]'`,
          },
          {
            name: 'data_summary',
            type: 'jsonb',
            isNullable: false,
            default: `'{}'`,
          },
          {
            name: 'confidence_percent',
            type: 'integer',
            isNullable: false,
            default: 70,
          },
          {
            name: 'guard_rails_applied',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'is_read',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'read_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        indices: [
          {
            name: 'idx_merchant_insights_merchant_id',
            columnNames: ['merchant_id'],
          },
          {
            name: 'idx_merchant_insights_type',
            columnNames: ['type'],
          },
          {
            name: 'idx_merchant_insights_created_at',
            columnNames: ['created_at'],
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'merchant_insights',
      new TableForeignKey({
        columnNames: ['merchant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'merchants',
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('merchant_insights');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('merchant_id') !== -1
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('merchant_insights', foreignKey);
      }
      await queryRunner.dropTable('merchant_insights');
    }
  }
}
