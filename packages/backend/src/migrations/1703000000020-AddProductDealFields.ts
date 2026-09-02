import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProductDealFields1703000000020 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('products', [
      new TableColumn({
        name: 'original_price_cents',
        type: 'bigint',
        isNullable: true,
      }),
      new TableColumn({
        name: 'discount_percent',
        type: 'integer',
        isNullable: true,
      }),
      new TableColumn({
        name: 'deal_active',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({
        name: 'deal_expires_at',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('products', 'deal_expires_at');
    await queryRunner.dropColumn('products', 'deal_active');
    await queryRunner.dropColumn('products', 'discount_percent');
    await queryRunner.dropColumn('products', 'original_price_cents');
  }
}
