import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMaxPromiseDaysToMerchantConfig1703000000014
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'merchant_configs',
      new TableColumn({
        name: 'max_promise_days',
        type: 'integer',
        default: 30,
        isNullable: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('merchant_configs', 'max_promise_days');
  }
}
