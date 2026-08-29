import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddPromiseToPayTable1703000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create promises_to_pay table
    await queryRunner.createTable(
      new Table({
        name: 'promises_to_pay',
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
            name: 'customer_interaction_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'pending'",
          },
          {
            name: 'promised_amount_cents',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'promised_deadline',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'promise_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'fulfilled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'missed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'outcome_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
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
      'promises_to_pay',
      new TableForeignKey({
        columnNames: ['recovery_case_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'recovery_cases',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'promises_to_pay',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'RESTRICT',
      })
    );

    await queryRunner.createForeignKey(
      'promises_to_pay',
      new TableForeignKey({
        columnNames: ['customer_interaction_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customer_interactions',
        onDelete: 'RESTRICT',
      })
    );

    // Add indexes
    await queryRunner.createIndex(
      'promises_to_pay',
      new TableIndex({
        columnNames: ['recovery_case_id'],
        name: 'idx_promises_recovery_case_id',
      })
    );

    await queryRunner.createIndex(
      'promises_to_pay',
      new TableIndex({
        columnNames: ['customer_id'],
        name: 'idx_promises_customer_id',
      })
    );

    await queryRunner.createIndex(
      'promises_to_pay',
      new TableIndex({
        columnNames: ['status'],
        name: 'idx_promises_status',
      })
    );

    await queryRunner.createIndex(
      'promises_to_pay',
      new TableIndex({
        columnNames: ['promised_deadline'],
        name: 'idx_promises_deadline',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('promises_to_pay', 'idx_promises_deadline');
    await queryRunner.dropIndex('promises_to_pay', 'idx_promises_status');
    await queryRunner.dropIndex('promises_to_pay', 'idx_promises_customer_id');
    await queryRunner.dropIndex('promises_to_pay', 'idx_promises_recovery_case_id');

    // Drop foreign keys
    const table = await queryRunner.getTable('promises_to_pay');
    if (table) {
      const fkRecoveryCase = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('recovery_case_id') !== -1
      );
      const fkCustomer = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('customer_id') !== -1
      );
      const fkInteraction = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('customer_interaction_id') !== -1
      );

      if (fkRecoveryCase) {
        await queryRunner.dropForeignKey('promises_to_pay', fkRecoveryCase);
      }
      if (fkCustomer) {
        await queryRunner.dropForeignKey('promises_to_pay', fkCustomer);
      }
      if (fkInteraction) {
        await queryRunner.dropForeignKey('promises_to_pay', fkInteraction);
      }
    }

    // Drop table
    await queryRunner.dropTable('promises_to_pay', true);
  }
}
