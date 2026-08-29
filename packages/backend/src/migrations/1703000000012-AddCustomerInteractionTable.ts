import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddCustomerInteractionTable1703000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create customer_interactions table
    await queryRunner.createTable(
      new Table({
        name: 'customer_interactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'recovery_case_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'channel',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'intent',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            default: null,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'customer_interactions',
      new TableForeignKey({
        columnNames: ['recovery_case_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'recovery_cases',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'customer_interactions',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'RESTRICT',
      })
    );

    // Add indexes
    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        columnNames: ['recovery_case_id'],
        name: 'idx_customer_interactions_recovery_case_id',
      })
    );

    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        columnNames: ['customer_id'],
        name: 'idx_customer_interactions_customer_id',
      })
    );

    await queryRunner.createIndex(
      'customer_interactions',
      new TableIndex({
        columnNames: ['created_at'],
        name: 'idx_customer_interactions_created_at',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('customer_interactions', 'idx_customer_interactions_created_at');
    await queryRunner.dropIndex('customer_interactions', 'idx_customer_interactions_customer_id');
    await queryRunner.dropIndex('customer_interactions', 'idx_customer_interactions_recovery_case_id');

    // Drop foreign keys
    const table = await queryRunner.getTable('customer_interactions');
    if (table) {
      const fkCustomerInteractionRecoveryCase = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('recovery_case_id') !== -1
      );
      const fkCustomerInteractionCustomer = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('customer_id') !== -1
      );

      if (fkCustomerInteractionRecoveryCase) {
        await queryRunner.dropForeignKey('customer_interactions', fkCustomerInteractionRecoveryCase);
      }
      if (fkCustomerInteractionCustomer) {
        await queryRunner.dropForeignKey('customer_interactions', fkCustomerInteractionCustomer);
      }
    }

    // Drop table
    await queryRunner.dropTable('customer_interactions', true);
  }
}
