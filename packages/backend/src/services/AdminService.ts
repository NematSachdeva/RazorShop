import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { MerchantApplication, ApplicationStatus } from '../models/MerchantApplication.js';
import { MerchantApplicationTimeline } from '../models/MerchantApplicationTimeline.js';
import { Merchant } from '../models/Merchant.js';
import { Customer } from '../models/Customer.js';

export class AdminService {
  private dataSource: DataSource;

  constructor(dataSource: DataSource = AppDataSource) {
    this.dataSource = dataSource;
  }

  private getAppRepo() {
    return this.dataSource.getRepository(MerchantApplication);
  }

  private getTimelineRepo() {
    return this.dataSource.getRepository(MerchantApplicationTimeline);
  }

  private getMerchantRepo() {
    return this.dataSource.getRepository(Merchant);
  }

  async getSummaryMetrics() {
    const appRepo = this.getAppRepo();
    const [pending_count, approved_count, rejected_count, total_count] = await Promise.all([
      appRepo.count({ where: { status: 'pending' } }),
      appRepo.count({ where: { status: 'approved' } }),
      appRepo.count({ where: { status: 'rejected' } }),
      appRepo.count(),
    ]);

    return {
      pending_count,
      approved_count,
      rejected_count,
      total_count,
    };
  }

  async getApplications(status?: ApplicationStatus, limit = 50, offset = 0) {
    const query = this.getAppRepo().createQueryBuilder('app').orderBy('app.created_at', 'DESC');

    if (status) {
      query.where('app.status = :status', { status });
    }

    const total_count = await query.getCount();
    const applications = await query.skip(offset).take(limit).getMany();

    const results = [];
    for (const app of applications) {
      const timeline = await this.getTimelineRepo().find({
        where: { application_id: app.id },
        order: { created_at: 'ASC' },
      });
      results.push({ ...app, timeline });
    }

    return { applications: results, total_count, limit, offset };
  }

  async getApplicationById(id: string) {
    const app = await this.getAppRepo().findOne({ where: { id } });
    if (!app) return null;

    const timeline = await this.getTimelineRepo().find({
      where: { application_id: id },
      order: { created_at: 'ASC' },
    });

    return { ...app, timeline };
  }

  async approveApplication(id: string, reviewerId: string) {
    return await this.dataSource.transaction(async (transactionalEntityManager) => {
      const appRepo = transactionalEntityManager.getRepository(MerchantApplication);
      const timelineRepo = transactionalEntityManager.getRepository(MerchantApplicationTimeline);
      const merchantRepo = transactionalEntityManager.getRepository(Merchant);
      const customerRepo = transactionalEntityManager.getRepository(Customer);

      const app = await appRepo.findOne({ where: { id } });
      if (!app) {
        throw new Error('Merchant application not found');
      }

      if (app.status === 'approved') {
        const timeline = await timelineRepo.find({
          where: { application_id: app.id },
          order: { created_at: 'ASC' },
        });
        return { ...app, timeline };
      }

      app.status = 'approved';
      app.reviewed_at = new Date();
      app.reviewer_id = reviewerId;
      app.rejection_reason = undefined as any;

      // Ensure corresponding Merchant entity is active
      let merchant = await merchantRepo.findOne({
        where: [{ id: app.customer_id }, { email: app.email }],
      });

      if (!merchant) {
        merchant = merchantRepo.create({
          id: app.customer_id,
          email: app.email,
          name: app.business_name || app.name,
          contact_phone: app.phone,
          status: 'active',
        });
      } else {
        merchant.status = 'active';
        if (app.business_name) merchant.name = app.business_name;
      }
      const savedMerchant = await merchantRepo.save(merchant);
      app.merchant_id = savedMerchant.id;

      // Ensure customer role is merchant
      const customer = await customerRepo.findOne({ where: { id: app.customer_id } });
      if (customer && customer.role !== 'merchant') {
        customer.role = 'merchant';
        await customerRepo.save(customer);
      }

      const savedApp = await appRepo.save(app);

      // Create APPROVED timeline event
      const timelineEvent = timelineRepo.create({
        application_id: app.id,
        event_type: 'APPROVED',
        actor_id: reviewerId,
        actor_role: 'admin',
        description: 'Application approved by administrator',
      });
      await timelineRepo.save(timelineEvent);

      const timeline = await timelineRepo.find({
        where: { application_id: app.id },
        order: { created_at: 'ASC' },
      });

      return { ...savedApp, timeline };
    });
  }

  async rejectApplication(id: string, reviewerId: string, rejectionReason: string) {
    if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim() === '') {
      throw new Error('A meaningful rejection reason is required');
    }

    return await this.dataSource.transaction(async (transactionalEntityManager) => {
      const appRepo = transactionalEntityManager.getRepository(MerchantApplication);
      const timelineRepo = transactionalEntityManager.getRepository(MerchantApplicationTimeline);
      const merchantRepo = transactionalEntityManager.getRepository(Merchant);

      const app = await appRepo.findOne({ where: { id } });
      if (!app) {
        throw new Error('Merchant application not found');
      }

      app.status = 'rejected';
      app.reviewed_at = new Date();
      app.reviewer_id = reviewerId;
      app.rejection_reason = rejectionReason.trim();

      // Deactivate merchant entity if created
      const merchant = await merchantRepo.findOne({
        where: [{ id: app.customer_id }, { email: app.email }],
      });
      if (merchant) {
        merchant.status = 'inactive';
        await merchantRepo.save(merchant);
      }

      const savedApp = await appRepo.save(app);

      // Create REJECTED timeline event
      const timelineEvent = timelineRepo.create({
        application_id: app.id,
        event_type: 'REJECTED',
        actor_id: reviewerId,
        actor_role: 'admin',
        description: rejectionReason.trim(),
      });
      await timelineRepo.save(timelineEvent);

      const timeline = await timelineRepo.find({
        where: { application_id: app.id },
        order: { created_at: 'ASC' },
      });

      return { ...savedApp, timeline };
    });
  }
}
