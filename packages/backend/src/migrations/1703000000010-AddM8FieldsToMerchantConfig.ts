import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddM8FieldsToMerchantConfig1703000000010 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('merchant_configs');
    if (table) {
      // Add M8 configuration fields
      await queryRunner.addColumn(
        'merchant_configs',
        new TableColumn({
          name: 'ai_insights_enabled',
          type: 'boolean',
          isNullable: false,
          default: true,
        })
      );

      await queryRunner.addColumn(
        'merchant_configs',
        new TableColumn({
          name: 'bundle_recommendations_enabled',
          type: 'boolean',
          isNullable: false,
          default: true,
        })
      );

      await queryRunner.addColumn(
        'merchant_configs',
        new TableColumn({
          name: 'discount_strategy_enabled',
          type: 'boolean',
          isNullable: false,
          default: true,
        })
      );

      await queryRunner.addColumn(
        'merchant_configs',
        new TableColumn({
          name: 'inventory_opt_enabled',
          type: 'boolean',
          isNullable: false,
          default: true,
        })
      );

      await queryRunner.addColumn(
        'merchant_configs',
        new TableColumn({
          name: 'recovery_targeting_enabled',
          type: 'boolean',
          isNullable: false,
          default: true,
        })
      );

      await queryRunner.addColumn(
        'merchant_configs',
        new TableColumn({
          name: 'min_confidence_score',
          type: 'integer',
          isNullable: false,
          default: 70,
          comment: 'Minimum confidence % for insights (0-100)',
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('merchant_configs');
    if (table) {
      await queryRunner.dropColumn('merchant_configs', 'ai_insights_enabled');
      await queryRunner.dropColumn('merchant_configs', 'bundle_recommendations_enabled');
      await queryRunner.dropColumn('merchant_configs', 'discount_strategy_enabled');
      await queryRunner.dropColumn('merchant_configs', 'inventory_opt_enabled');
      await queryRunner.dropColumn('merchant_configs', 'recovery_targeting_enabled');
      await queryRunner.dropColumn('merchant_configs', 'min_confidence_score');
    }
  }
}
