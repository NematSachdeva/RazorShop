import { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { Payment, PaymentStatus } from '../models/Payment.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { Order } from '../models/Order.js';
import crypto from 'crypto';

// Razorpay client abstraction
export class RazorpayClient {
  private keyId: string;
  private keySecret: string;

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
  }

  /**
   * Mock implementation for M4 - creates a Razorpay order
   * In production, this would call the actual Razorpay SDK
   */
  async createOrder(amountPaise: number, orderId: string): Promise<{ id: string }> {
    // For Phase 4, we mock the Razorpay API
    // In production: const razorpay = new Razorpay({ key_id: this.keyId, key_secret: this.keySecret })
    // return razorpay.orders.create({ amount, currency: 'INR' })

    // Mock: Generate a fake Razorpay order ID
    const mockOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;
    return { id: mockOrderId };
  }

  /**
   * Verify Razorpay signature
   * Signature = HMAC-SHA256(orderId|paymentId, keySecret)
   */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    const message = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(message)
      .digest('hex');

    return expectedSignature === signature;
  }
}

// Local DTO types
export interface PaymentDTO {
  id: string;
  order_id: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  status: PaymentStatus;
  amount_cents: number;
  failure_reason?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentResponse {
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount_cents: number;
  currency: string;
}

export interface VerifyPaymentRequest {
  order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export class PaymentService {
  private dataSource: DataSource;
  private razorpayClient: RazorpayClient;

  constructor(dataSource: DataSource = AppDataSource, razorpayClient?: RazorpayClient) {
    this.dataSource = dataSource;

    // Create Razorpay client if not provided (for testing)
    if (razorpayClient) {
      this.razorpayClient = razorpayClient;
    } else {
      const keyId = process.env.RAZORPAY_KEY_ID || '';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
      this.razorpayClient = new RazorpayClient(keyId, keySecret);
    }
  }

  private getPaymentRepository() {
    return this.dataSource.getRepository(Payment);
  }

  private getPaymentAttemptRepository() {
    return this.dataSource.getRepository(PaymentAttempt);
  }

  private getOrderRepository() {
    return this.dataSource.getRepository(Order);
  }

  /**
   * Create a payment attempt and Razorpay order
   */
  async createPaymentAttempt(orderId: string): Promise<CreatePaymentResponse> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Verify order exists
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: orderId },
      });

      if (!order) {
        throw new Error('Order not found');
      }

      // 2. Verify order can be paid
      if (order.status !== 'pending') {
        throw new Error('Order is not in pending state');
      }

      // 3. Check if a payment already exists for this order
      const existingPayment = await queryRunner.manager.findOne(Payment, {
        where: { order_id: orderId },
      });

      let payment: Payment;
      let attemptNumber = 1;

      if (existingPayment) {
        // Payment exists - check if we can retry
        if (existingPayment.status === 'captured') {
          throw new Error('Order payment already captured');
        }

        // For failed payments, allow retry - increment attempt number
        if (existingPayment.status === 'failed') {
          const lastAttempt = await queryRunner.manager.findOne(PaymentAttempt, {
            where: { order_id: orderId },
            order: { attempt_number: 'DESC' },
          });
          attemptNumber = (lastAttempt?.attempt_number || 0) + 1;
          payment = existingPayment;
        } else {
          throw new Error('Cannot create new payment attempt while one is pending');
        }
      } else {
        // Create new payment record
        payment = queryRunner.manager.create(Payment, {
          order_id: orderId,
          amount_cents: order.total_cents,
          status: 'initiated',
        });
        payment = await queryRunner.manager.save(payment);
      }

      // 4. Create Razorpay order (mock for M4)
      const razorpayOrder = await this.razorpayClient.createOrder(
        Number(order.total_cents),
        orderId
      );

      // 5. Create payment attempt record
      const paymentAttempt = queryRunner.manager.create(PaymentAttempt, {
        order_id: orderId,
        razorpay_order_id: razorpayOrder.id,
        attempt_number: attemptNumber,
      });
      await queryRunner.manager.save(paymentAttempt);

      // 6. Update payment status
      payment.status = 'pending';
      await queryRunner.manager.save(payment);

      await queryRunner.commitTransaction();

      return {
        razorpay_order_id: razorpayOrder.id,
        razorpay_key_id: process.env.RAZORPAY_KEY_ID || '',
        amount_cents: Number(order.total_cents),
        currency: 'INR',
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Verify payment signature and mark payment as captured
   */
  async verifyPayment(request: VerifyPaymentRequest): Promise<PaymentDTO> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validate request
      if (!request.order_id || !request.razorpay_payment_id || !request.razorpay_signature) {
        throw new Error('Missing required payment verification fields');
      }

      // 2. Verify signature
      const isValidSignature = this.razorpayClient.verifySignature(
        request.order_id,
        request.razorpay_payment_id,
        request.razorpay_signature
      );

      if (!isValidSignature) {
        throw new Error('Invalid payment signature');
      }

      // 3. Load payment
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { order_id: request.order_id },
      });

      if (!payment) {
        throw new Error('Payment not found for order');
      }

      // 4. Check idempotency - already captured with same payment ID
      if (payment.status === 'captured' && payment.razorpay_payment_id === request.razorpay_payment_id) {
        return this.paymentToDTO(payment);
      }

      // 5. Prevent double-capture with different payment IDs
      if (payment.status === 'captured') {
        throw new Error('Order payment already captured with different payment ID');
      }

      // 6. Update payment record
      payment.status = 'captured';
      payment.razorpay_payment_id = request.razorpay_payment_id;
      payment.razorpay_signature = request.razorpay_signature;
      await queryRunner.manager.save(payment);

      // 7. Update order status to confirmed
      const order = await queryRunner.manager.findOne(Order, {
        where: { id: request.order_id },
      });

      if (order) {
        order.status = 'confirmed';
        await queryRunner.manager.save(order);
      }

      await queryRunner.commitTransaction();

      return this.paymentToDTO(payment);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<PaymentDTO | null> {
    const payment = await this.getPaymentRepository().findOne({
      where: { order_id: orderId },
    });

    return payment ? this.paymentToDTO(payment) : null;
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<PaymentDTO | null> {
    const payment = await this.getPaymentRepository().findOne({
      where: { id: paymentId },
    });

    return payment ? this.paymentToDTO(payment) : null;
  }

  /**
   * Get latest payment attempt for order
   */
  async getLatestPaymentAttempt(orderId: string): Promise<PaymentAttempt | null> {
    return this.getPaymentAttemptRepository().findOne({
      where: { order_id: orderId },
      order: { attempt_number: 'DESC' },
    });
  }

  /**
   * Convert Payment entity to DTO
   */
  private paymentToDTO(payment: Payment): PaymentDTO {
    return {
      id: payment.id,
      order_id: payment.order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      razorpay_signature: payment.razorpay_signature,
      status: payment.status,
      amount_cents: Number(payment.amount_cents),
      failure_reason: payment.failure_reason,
      created_at: payment.created_at,
      updated_at: payment.updated_at,
    };
  }
}

export const paymentService = new PaymentService();
