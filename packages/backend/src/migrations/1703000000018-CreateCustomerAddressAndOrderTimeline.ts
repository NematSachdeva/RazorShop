import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class CreateCustomerAddressAndOrderTimeline1703000000018 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create customer_addresses table
    await queryRunner.createTable(
      new Table({
        name: 'customer_addresses',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'customer_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'full_address',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'state',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'pin_code',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          {
            name: 'is_default',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'customer_addresses',
      new TableForeignKey({
        columnNames: ['customer_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'customers',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createIndex(
      'customer_addresses',
      new TableIndex({
        name: 'idx_customer_addresses_customer_id',
        columnNames: ['customer_id'],
      })
    );

    // 2. Add shipping_address JSON column to orders
    const ordersTable = await queryRunner.getTable('orders');
    if (ordersTable && !ordersTable.findColumnByName('shipping_address')) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'shipping_address',
          type: 'jsonb',
          isNullable: true,
        })
      );
    }

    // 3. Create order_timeline table
    await queryRunner.createTable(
      new Table({
        name: 'order_timeline',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'order_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'event_type',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'actor_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'actor_role',
            type: 'varchar',
            length: '20',
            default: "'system'",
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      'order_timeline',
      new TableForeignKey({
        columnNames: ['order_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'orders',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createIndex(
      'order_timeline',
      new TableIndex({
        name: 'idx_order_timeline_order_id',
        columnNames: ['order_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_timeline');
    const ordersTable = await queryRunner.getTable('orders');
    if (ordersTable && ordersTable.findColumnByName('shipping_address')) {
      await queryRunner.dropColumn('orders', 'shipping_address');
    }
    await queryRunner.dropTable('customer_addresses');
  }
}
