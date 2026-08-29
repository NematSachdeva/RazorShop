import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBundleDiscountToCartAndOrder1703000000015
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('carts', [
      new TableColumn({
        name: 'bundle_recommendation_id',
        type: 'uuid',
        isNullable: true,
      }),
      new TableColumn({
        name: 'discount_percent',
        type: 'integer',
        default: 0,
        isNullable: false,
      }),
      new TableColumn({
        name: 'discount_cents',
        type: 'bigint',
        default: 0,
        isNullable: false,
      }),
    ]);

    await queryRunner.addColumn(
      'orders',
      new TableColumn({
        name: 'discount_cents',
        type: 'bigint',
        default: 0,
        isNullable: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('orders', 'discount_cents');
    await queryRunner.dropColumn('carts', 'discount_cents');
    await queryRunner.dropColumn('carts', 'discount_percent');
    await queryRunner.dropColumn('carts', 'bundle_recommendation_id');
  }
}
