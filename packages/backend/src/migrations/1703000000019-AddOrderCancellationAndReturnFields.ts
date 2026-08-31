import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrderCancellationAndReturnFields1703000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const ordersTable = await queryRunner.getTable('orders');
    if (!ordersTable) return;

    const columnsToAdd: TableColumn[] = [];

    if (!ordersTable.findColumnByName('cancellation_reason')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'cancellation_reason',
          type: 'text',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('cancellation_timestamp')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'cancellation_timestamp',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('cancelled_by')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'cancelled_by',
          type: 'varchar',
          length: '20',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('refund_amount_cents')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'refund_amount_cents',
          type: 'bigint',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('refund_status')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'refund_status',
          type: 'varchar',
          length: '20',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('return_status')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'return_status',
          type: 'varchar',
          length: '50',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('return_reason')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'return_reason',
          type: 'text',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('return_requested_at')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'return_requested_at',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('return_approved_at')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'return_approved_at',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('return_rejected_at')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'return_rejected_at',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('return_rejection_reason')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'return_rejection_reason',
          type: 'text',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('pickup_scheduled_at')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'pickup_scheduled_at',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('pickup_notes')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'pickup_notes',
          type: 'text',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('picked_up_at')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'picked_up_at',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('return_in_transit_at')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'return_in_transit_at',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('returned_to_seller_at')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'returned_to_seller_at',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (!ordersTable.findColumnByName('refund_initiated_at')) {
      columnsToAdd.push(
        new TableColumn({
          name: 'refund_initiated_at',
          type: 'timestamp with time zone',
          isNullable: true,
        })
      );
    }

    if (columnsToAdd.length > 0) {
      await queryRunner.addColumns('orders', columnsToAdd);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ordersTable = await queryRunner.getTable('orders');
    if (!ordersTable) return;

    const columnNames = [
      'cancellation_reason',
      'cancellation_timestamp',
      'cancelled_by',
      'refund_amount_cents',
      'refund_status',
      'return_status',
      'return_reason',
      'return_requested_at',
      'return_approved_at',
      'return_rejected_at',
      'return_rejection_reason',
      'pickup_scheduled_at',
      'pickup_notes',
      'picked_up_at',
      'return_in_transit_at',
      'returned_to_seller_at',
      'refund_initiated_at',
    ];

    for (const name of columnNames) {
      if (ordersTable.findColumnByName(name)) {
        await queryRunner.dropColumn('orders', name);
      }
    }
  }
}
