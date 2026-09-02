import { DataSource, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { AnalyticsService } from './AnalyticsService.js';
import { OrderService } from './OrderService.js';
import { Product } from '../models/Product.js';
import { Order, OrderStatus } from '../models/Order.js';
import { OrderItem } from '../models/OrderItem.js';
import { Cart } from '../models/Cart.js';
import { CartItem } from '../models/CartItem.js';
import { Customer } from '../models/Customer.js';
import { OrderTimeline } from '../models/OrderTimeline.js';
import { Inventory } from '../models/Inventory.js';
import { Payment } from '../models/Payment.js';
import { PaymentAttempt } from '../models/PaymentAttempt.js';
import { AuditLog } from '../models/AuditLog.js';
import { EmailService } from './EmailService.js';
import { env } from '../config/env.js';
import { randomUUID } from 'crypto';

export type HelperActionType =
  | 'CREATE_DEAL_AND_EMAIL'
  | 'UPDATE_ORDER_STATUS'
  | 'INITIATE_REFUND'
  | 'PROCESS_RETURN'
  | 'UPDATE_PRODUCT_PRICE'
  | 'UPDATE_PRODUCT_STOCK'
  | 'RESTORE_PRODUCT_PRICE'
  | 'CANCEL_ORDER';

export interface DealActionProposal {
  proposalId: string;
  actionType: HelperActionType;
  scope?: 'product' | 'cart';

  // Deal fields
  productId?: string;
  productName?: string;
  originalPriceCents?: number;
  discountPercent?: number;
  dealPriceCents?: number;
  isBulk?: boolean;
  targetCartId?: string;
  affectedCartsList?: Array<{
    cartId: string;
    customerId?: string;
    customerName: string;
    customerEmail: string;
    productId: string;
    productName: string;
    unitPriceCents?: number;
    originalPriceCents: number;
    dealPriceCents: number;
    items?: Array<{
      productId: string;
      productName: string;
      quantity: number;
      originalPriceCents: number;
      dealPriceCents: number;
    }>;
    originalCartTotalCents?: number;
    dealCartTotalCents?: number;
  }>;
  cartItemsSummary?: Array<{
    productId: string;
    productName: string;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }>;
  durationValue?: number;
  durationUnit?: 'minutes' | 'hours' | 'days';
  expiresInMinutes?: number;
  sendEmail?: boolean;
  eligibleCustomers?: Array<{
    id: string;
    name?: string;
    email: string;
  }>;
  cartInstancesCount?: number;
  uniqueCustomersCount?: number;
  totalUnitsCount?: number;

  // Order / Return / Refund fields
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  currentOrderStatus?: string;
  newOrderStatus?: OrderStatus;
  currentReturnStatus?: string;
  newReturnStatus?: string;
  refundAmountCents?: number;

  // Product fields
  currentPriceCents?: number;
  newPriceCents?: number;
  currentStock?: number;
  newStock?: number;

  // Human readable description
  description?: string;
}

export interface HelperChatResponse {
  message: string;
  proposal: DealActionProposal | null;
  requiresConfirmation: boolean;
  actionExecuted?: boolean;
  actionResult?: {
    productName?: string;
    orderNumber?: string;
    scope?: 'product' | 'cart';
    discountPercent?: number;
    dealPriceRupees?: number;
    originalPriceRupees?: number;
    eligibleCount?: number;
    emailsSentCount?: number;
    emailsFailedCount?: number;
    expiresInMinutes?: number;
    newStatus?: string;
    refundAmountRupees?: number;
    newPriceRupees?: number;
    newStock?: number;
  };
}

export class MerchantHelperService {
  private dataSource: DataSource;
  private analyticsService: AnalyticsService;
  private orderService: OrderService;
  private emailService: EmailService;

  constructor(
    dataSource: DataSource = AppDataSource,
    emailService: EmailService = new EmailService(),
    orderService: OrderService = new OrderService(dataSource)
  ) {
    this.dataSource = dataSource;
    this.analyticsService = new AnalyticsService(dataSource);
    this.orderService = orderService;
    this.emailService = emailService;
  }

  /**
   * Helper to format Rupee amount cleanly
   */
  private formatRupees(amountInRupees: number): string {
    return `₹${amountInRupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Helper to detect language style of user prompt (English, Hindi, Hinglish)
   */
  private detectLanguageStyle(text: string): 'english' | 'hindi' | 'hinglish' {
    const lower = text.toLowerCase();
    if (/[\u0900-\u097F]/.test(text)) {
      return 'hindi';
    }
    const hinglishWords = ['kaunse', 'kaunsa', 'mera', 'mere', 'meri', 'hai', 'hain', 'kya', 'dene', 'sakte', 'batao', 'dikhaye', 'de do', 'karo', 'mujhe', 'kitne', 'par', 'ko', 'kar do', 'bhej do', 'un', 'pe', 'puri', 'wanna', 'chahiye', 'karlo'];
    const words = lower.split(/\s+/);
    if (words.some((w) => hinglishWords.includes(w))) {
      return 'hinglish';
    }
    return 'english';
  }

  /**
   * Parse discount percentage from natural language input
   */
  private parseDiscount(text: string): number | null {
    const match = text.match(/(\d+)\s*(%|percent|per cent|off)/i) || text.match(/(?:discount|give|offer|make it)\s*(\d+)/i);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > 0 && val <= 100) {
        return val;
      }
    }
    return null;
  }

  /**
   * Parse flexible duration from natural language input
   */
  private parseDuration(text: string): { durationValue: number; durationUnit: 'minutes' | 'hours' | 'days'; expiresInMinutes: number } | null {
    const lower = text.toLowerCase();

    if (lower.includes('kal tak')) {
      return { durationValue: 1, durationUnit: 'days', expiresInMinutes: 1440 };
    }

    const minMatch = lower.match(/(\d+)\s*(min|minute|minutes|m)/i);
    if (minMatch) {
      const val = parseInt(minMatch[1], 10);
      if (!isNaN(val) && val > 0) {
        return { durationValue: val, durationUnit: 'minutes', expiresInMinutes: val };
      }
    }

    const hrMatch = lower.match(/(\d+)\s*(hr|hour|hours|h)/i);
    if (hrMatch) {
      const val = parseInt(hrMatch[1], 10);
      if (!isNaN(val) && val > 0) {
        return { durationValue: val, durationUnit: 'hours', expiresInMinutes: val * 60 };
      }
    }

    const dayMatch = lower.match(/(\d+)\s*(day|days|din|d)/i);
    if (dayMatch) {
      const val = parseInt(dayMatch[1], 10);
      if (!isNaN(val) && val > 0) {
        return { durationValue: val, durationUnit: 'days', expiresInMinutes: val * 1440 };
      }
    }

    return null;
  }

  /**
   * Parse scope (entire cart vs single product)
   */
  private parseScope(text: string, hasExplicitProductMatch = false): 'cart' | 'product' | null {
    const lower = text.toLowerCase();
    if (lower.includes('puri cart') || lower.includes('entire cart') || lower.includes('all cart') || lower.includes('entire abandoned cart')) {
      return 'cart';
    }
    if (hasExplicitProductMatch || lower.includes('this product') || lower.includes('single product')) {
      return 'product';
    }
    if (lower.includes('cart') || lower.includes('in abandoned carts') || lower.includes('abandoned carts')) {
      return 'cart';
    }
    return null;
  }

  /**
   * Parse explicit email flag
   */
  private parseEmailFlag(text: string): boolean | null {
    const lower = text.toLowerCase();
    if (lower.includes('no mail') || lower.includes("don't email") || lower.includes('dont email') || lower.includes('email mat')) {
      return false;
    }
    if (lower.includes('email') || lower.includes('mail') || lower.includes('bhej') || lower.includes('send')) {
      return true;
    }
    return null;
  }

  /**
   * Format human readable duration string
   */
  private formatDurationDisplay(val: number, unit: 'minutes' | 'hours' | 'days'): string {
    if (unit === 'minutes') return `${val} minute${val > 1 ? 's' : ''}`;
    if (unit === 'hours') return `${val} hour${val > 1 ? 's' : ''}`;
    return `${val} day${val > 1 ? 's' : ''}`;
  }

  /**
   * Helper to extract order reference number from prompt or recent conversation history
   */
  private extractReferencedOrderNumber(
    userMessage: string,
    history: Array<{ role: string; content: string }> = []
  ): string | null {
    const directMatch = userMessage.match(/#?(ORD-[A-Za-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (directMatch) return directMatch[1].replace('#', '');

    for (let i = history.length - 1; i >= 0; i--) {
      const match = history[i].content.match(/#?(ORD-[A-Za-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (match) {
        return match[1].replace('#', '');
      }
    }
    return null;
  }

  /**
   * Main entry point to process merchant chatbot message
   */
  async processChatMessage(
    merchantId: string,
    userMessage: string,
    pendingProposal?: DealActionProposal | null,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<HelperChatResponse> {
    const lang = this.detectLanguageStyle(userMessage);
    const trimmed = userMessage.trim().toLowerCase();

    // 1. Check explicit cancellation
    const cancelWords = ['cancel', 'stop', 'no deal', 'forget it', 'radd', 'mat karo'];
    if (cancelWords.some((w) => trimmed === w || trimmed.startsWith(w)) && !trimmed.includes('order')) {
      let cancelMsg = 'Proposal cancelled. Is there anything else I can help you with?';
      if (lang === 'hinglish') cancelMsg = 'Proposal cancel kar diya gaya hai. Kya main aapki kisi aur cheez me madad kar sakta hu?';
      if (lang === 'hindi') cancelMsg = 'प्रस्ताव रद्द कर दिया गया है। क्या मैं आपकी किसी अन्य चीज़ में सहायता कर सकता हूँ?';

      return {
        message: cancelMsg,
        proposal: null,
        requiresConfirmation: false,
      };
    }

    // 2. Check explicit double confirmation for a pending proposal
    const confirmationWords = ['yes', 'confirm', 'go ahead', 'do it', 'proceed', 'haan', 'ha', 'kardo', 'chalo', 'ok', 'sure', 'yes, mark it dispatched', 'confirm it', 'yes do that', 'confirm karo', 'theek hai, kar do'];
    const isConfirmation = confirmationWords.some((w) => trimmed === w || trimmed.startsWith(w));

    if (pendingProposal && isConfirmation) {
      const result = await this.executeActionProposal(merchantId, pendingProposal);
      return result;
    }

    // 2B. Contextual Cancellation Reason Query
    if (trimmed.includes('reason') || (trimmed.includes('why') && (trimmed.includes('cancel') || trimmed.includes('returned')))) {
      const refOrderNum = this.extractReferencedOrderNumber(userMessage, history);
      if (refOrderNum) {
        const orderRepo = this.dataSource.getRepository(Order);
        const order = await orderRepo.findOne({
          where: [
            { order_number: refOrderNum },
            { order_number: `ORD-${refOrderNum}` },
            { order_number: `#${refOrderNum}` },
          ],
          relations: ['customer'],
        });

        if (order) {
          const reason = order.cancellation_reason || order.return_reason || 'Cancelled by merchant or customer requested cancellation.';
          let respMsg = `Order **#${order.order_number}** (${order.customer?.name || 'Customer'}) status is **${order.status}**. Reason for cancellation: "${reason}".`;
          if (lang === 'hinglish') {
            respMsg = `Order **#${order.order_number}** (${order.customer?.name || 'Customer'}) ka status **${order.status}** hai. Cancellation reason: "${reason}".`;
          } else if (lang === 'hindi') {
            respMsg = `ऑर्डर **#${order.order_number}** की स्थिति **${order.status}** है। रद्द करने का कारण: "${reason}"।`;
          }
          return {
            message: respMsg,
            proposal: null,
            requiresConfirmation: false,
          };
        }
      }
    }

    // 3. Question about maximum discount allowed ("maximum kitna discount de sakte hain?")
    if (trimmed.includes('max') && trimmed.includes('discount')) {
      let maxAnswer = 'As a merchant, you have full authority to grant any discount percentage you decide (e.g., 10%, 20%, 50%, or 90%). AI recommendations (typically 15–25%) are non-binding suggestions to protect margins. What discount percentage would you like to offer your customers?';
      if (lang === 'hinglish') {
        maxAnswer = 'Aap merchant hain aur aapke paas full authority hai ki aap jitna chahe discount de sakte hain (e.g., 10%, 20%, 50%, ya 90%). AI recommendations (15-25%) sirf profit margins protect karne ke liye suggestions hain. Aap kitna discount dena chahte hain?';
      } else if (lang === 'hindi') {
        maxAnswer = 'एक व्यापारी के रूप में, आपके पास कोई भी छूट प्रतिशत (जैसे 10%, 20%, 50%, या 90%) देने का पूरा अधिकार है। AI की सिफारिशें (15-25%) केवल सुझाव हैं। आप ग्राहकों को कितनी छूट देना चाहते हैं?';
      }

      return {
        message: maxAnswer,
        proposal: null,
        requiresConfirmation: false,
      };
    }

    // 4. Operational Action Intent Detection & Proposal Building
    const actionProposal = await this.detectAndBuildOperationalAction(merchantId, userMessage, pendingProposal, history);
    if (actionProposal) {
      // If error message string returned due to invalid state transition, return informational response without mutating
      if (typeof actionProposal === 'string') {
        return {
          message: actionProposal,
          proposal: null,
          requiresConfirmation: false,
        };
      }

      const msg = this.formatActionConfirmationMessage(actionProposal, lang);
      return {
        message: msg,
        proposal: actionProposal,
        requiresConfirmation: true,
      };
    }

    // 5. Full-Spectrum Grounded Database Context Retrieval for READ Queries
    const contextData = await this.retrieveGroundedContext(merchantId, userMessage);
    const answer = await this.generateGroqResponse(merchantId, userMessage, contextData, lang, history);

    return {
      message: answer,
      proposal: null, // Invalidate stale proposals on unrelated queries
      requiresConfirmation: false,
    };
  }

  /**
   * Detect and build operational action proposals (Order status, Refund, Return, Product price/stock, Deal)
   */
  private async detectAndBuildOperationalAction(
    merchantId: string,
    userMessage: string,
    pendingProposal?: DealActionProposal | null,
    history: Array<{ role: string; content: string }> = []
  ): Promise<DealActionProposal | string | null> {
    const lower = userMessage.toLowerCase();
    const orderRepo = this.dataSource.getRepository(Order);
    const productRepo = this.dataSource.getRepository(Product);

    // 1. Order Status Actions (Dispatch, Deliver, Cancel)
    const isDispatch = lower.includes('dispatch') || lower.includes('shipped') || lower.includes('bhej');
    const isDeliver = lower.includes('deliver') || lower.includes('deliverd') || lower.includes('pohanch');
    const isCancelOrder = (lower.includes('cancel') || lower.includes('radd')) && (lower.includes('order') || lower.includes('#'));
    const isRefund = lower.includes('refund') || lower.includes('wapas paisa');
    const isReturnProcess = lower.includes('return') || lower.includes('wapas');
    const isProductPrice = (lower.includes('price') || lower.includes('cost') || lower.includes('discount')) && (lower.includes('change') || lower.includes('update') || lower.includes('set') || lower.includes('to ₹') || lower.includes('to '));

    // Resolve order reference (#1234 or UUID or recent order)
    const orderNumMatch = userMessage.match(/#?([A-Za-z0-9-]+)/);

    // 1A. Order Dispatch Action
    if (isDispatch) {
      const order = await this.findMatchingMerchantOrder(merchantId, userMessage, history);
      if (order) {
        if (order.status !== 'confirmed' && order.status !== 'pending') {
          return `Order '${order.order_number}' is currently in '${order.status}' status. Dispatched requires status to be 'confirmed'.`;
        }

        return {
          proposalId: randomUUID(),
          actionType: 'UPDATE_ORDER_STATUS',
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer?.name || 'Customer',
          customerEmail: order.customer?.email || 'N/A',
          currentOrderStatus: order.status,
          newOrderStatus: 'dispatched',
          description: `Mark Order ${order.order_number} as Dispatched`,
        };
      }
    }

    // 1B. Order Delivery Action
    if (isDeliver) {
      const order = await this.findMatchingMerchantOrder(merchantId, userMessage, history);
      if (order) {
        // STATE MACHINE CHECK: Confirmed -> Delivered directly is INVALID
        if (order.status === 'confirmed' || order.status === 'pending') {
          return `Order '${order.order_number}' is currently 'Confirmed'. I cannot move it directly to 'Delivered' because 'Dispatched' is the required previous stage. Would you like me to prepare the action to mark Order '${order.order_number}' as Dispatched first?`;
        }
        if (order.status !== 'dispatched' && order.status !== 'shipped') {
          return `Order '${order.order_number}' is currently '${order.status}'. Delivered requires status to be 'Dispatched'.`;
        }

        return {
          proposalId: randomUUID(),
          actionType: 'UPDATE_ORDER_STATUS',
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer?.name || 'Customer',
          customerEmail: order.customer?.email || 'N/A',
          currentOrderStatus: order.status,
          newOrderStatus: 'delivered',
          description: `Mark Order ${order.order_number} as Delivered`,
        };
      }
    }

    // 1C. Order Cancellation Action
    if (isCancelOrder) {
      const order = await this.findMatchingMerchantOrder(merchantId, userMessage, history);
      if (order) {
        if (order.status === 'delivered') {
          return `Order '${order.order_number}' cannot be cancelled after delivery.`;
        }

        return {
          proposalId: randomUUID(),
          actionType: 'CANCEL_ORDER',
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer?.name || 'Customer',
          customerEmail: order.customer?.email || 'N/A',
          currentOrderStatus: order.status,
          newOrderStatus: 'cancelled',
          description: `Cancel Order ${order.order_number}`,
        };
      }
    }

    // 1D. Refund Initiation Action
    if (isRefund) {
      const order = await this.findMatchingMerchantOrder(merchantId, userMessage, history);
      if (order) {
        const refundAmountCents = Number(order.total_cents);
        return {
          proposalId: randomUUID(),
          actionType: 'INITIATE_REFUND',
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer?.name || 'Customer',
          customerEmail: order.customer?.email || 'N/A',
          currentOrderStatus: order.status,
          currentReturnStatus: order.return_status || order.status,
          newReturnStatus: 'refund_initiated',
          refundAmountCents,
          description: `Initiate Refund of ${this.formatRupees(refundAmountCents / 100)} for Order ${order.order_number}`,
        };
      }
    }

    // 1E. Product Price Change Action
    if (isProductPrice && (lower.includes('change') || lower.includes('update') || lower.includes('set') || lower.includes('price'))) {
      const priceMatch = userMessage.match(/(?:₹|rs|rs\.|price|to)\s*(\d+(?:\.\d+)?)/i);
      if (priceMatch) {
        const newPriceVal = parseFloat(priceMatch[1]);
        if (!isNaN(newPriceVal) && newPriceVal > 0) {
          const merchantProducts = await productRepo.find({
            where: [{ merchant_id: merchantId }, { merchant_id: IsNull() }],
          });
          let matchedProd: Product | undefined;
          for (const p of merchantProducts) {
            if (lower.includes(p.name.toLowerCase())) {
              matchedProd = p;
              break;
            }
          }
          if (!matchedProd && merchantProducts.length > 0) {
            matchedProd = merchantProducts[0];
          }

          if (matchedProd) {
            const currentPriceCents = Number(matchedProd.price_cents);
            const newPriceCents = Math.round(newPriceVal * 100);

            return {
              proposalId: randomUUID(),
              actionType: 'UPDATE_PRODUCT_PRICE',
              productId: matchedProd.id,
              productName: matchedProd.name,
              currentPriceCents,
              newPriceCents,
              description: `Change price of ${matchedProd.name} from ${this.formatRupees(currentPriceCents / 100)} to ${this.formatRupees(newPriceVal)}`,
            };
          }
        }
      }
    }

    // 1F. Multi-turn modification of an existing pending proposal or new deal request
    const isDealIntent = /deal|offer|discount|off|coupon|percent|%|samose|expire|minute|hour|day|kal tak|mail|email|bhej|wanna/i.test(userMessage);

    if (pendingProposal && isDealIntent) {
      const parsedDisc = this.parseDiscount(userMessage);
      const parsedDur = this.parseDuration(userMessage);
      const parsedScp = this.parseScope(userMessage);
      const parsedEml = this.parseEmailFlag(userMessage);

      const updatedProposal: DealActionProposal = {
        ...pendingProposal,
        proposalId: randomUUID(),
        discountPercent: parsedDisc !== null ? parsedDisc : pendingProposal.discountPercent,
        durationValue: parsedDur ? parsedDur.durationValue : pendingProposal.durationValue,
        durationUnit: parsedDur ? parsedDur.durationUnit : pendingProposal.durationUnit,
        expiresInMinutes: parsedDur ? parsedDur.expiresInMinutes : pendingProposal.expiresInMinutes,
        scope: parsedScp !== null ? parsedScp : pendingProposal.scope,
        sendEmail: parsedEml !== null ? parsedEml : pendingProposal.sendEmail,
      };

      if (updatedProposal.originalPriceCents) {
        const discountAmountCents = Math.round(updatedProposal.originalPriceCents * ((updatedProposal.discountPercent || 10) / 100));
        updatedProposal.dealPriceCents = updatedProposal.originalPriceCents - discountAmountCents;
      }

      return updatedProposal;
    }

    if (isDealIntent) {
      const prop = await this.buildDealProposal(merchantId, userMessage, history);
      if (!prop || (prop.affectedCartsList && prop.affectedCartsList.length === 0 && prop.scope === 'cart')) {
        return "There are currently 0 abandoned carts, so there are no customers to target with this deal.";
      }
      return prop;
    }

    return null;
  }

  /**
   * Helper to find matching order by order number, ID, or recent order
   */
  private async findMatchingMerchantOrder(
    merchantId: string,
    text: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<Order | null> {
    const orderRepo = this.dataSource.getRepository(Order);
    const refNum = this.extractReferencedOrderNumber(text, history);

    if (refNum) {
      const whereConditions: any[] = [
        { order_number: refNum },
        { order_number: `ORD-${refNum}` },
        { order_number: `#${refNum}` },
      ];
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refNum)) {
        whereConditions.push({ id: refNum });
      }

      const order = await orderRepo.findOne({
        where: whereConditions,
        relations: ['items', 'items.product', 'customer'],
      });
      if (order) return order;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const ignoreWords = ['mark', 'order', 'as', 'for', 'initiate', 'the', 'refund', 'dispatched', 'delivered', 'cancel', 'process'];

    const orderNumMatches = text.match(/#?([A-Za-z0-9-]+)/g);
    if (orderNumMatches) {
      for (const num of orderNumMatches) {
        const cleaned = num.replace('#', '').trim();
        if (cleaned.length >= 3 && !ignoreWords.includes(cleaned.toLowerCase())) {
          const whereConditions: any[] = [
            { order_number: cleaned },
            { order_number: `ORD-${cleaned}` },
            { order_number: `#${cleaned}` },
          ];
          if (uuidRegex.test(cleaned)) {
            whereConditions.push({ id: cleaned });
          }

          const order = await orderRepo.findOne({
            where: whereConditions,
            relations: ['items', 'items.product', 'customer'],
          });
          if (order) return order;
        }
      }
    }

    // Fallback: Get most recent order for merchant
    const recentOrder = await orderRepo.findOne({
      where: {},
      relations: ['items', 'items.product', 'customer'],
      order: { created_at: 'DESC' },
    });

    return recentOrder || null;
  }

  /**
   * Helper to extract referenced cart ID or index from prompt or recent conversation history
   */
  private extractReferencedCartId(
    userMessage: string,
    history: Array<{ role: string; content: string }> = []
  ): string | null {
    const directUuidMatch = userMessage.match(/#?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (directUuidMatch) return directUuidMatch[1];

    const directIndexMatch = userMessage.match(/cart\s*#?\s*(\d+)/i);
    if (directIndexMatch) return directIndexMatch[1];

    for (let i = history.length - 1; i >= 0; i--) {
      const hContent = history[i].content;
      const uuidMatch = hContent.match(/#?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (uuidMatch) return uuidMatch[1];

      const idxMatch = hContent.match(/cart\s*#?\s*(\d+)/i);
      if (idxMatch) return idxMatch[1];
    }

    return null;
  }

  /**
   * Format natural language action confirmation message with explicit state comparison
   */
  private formatActionConfirmationMessage(proposal: DealActionProposal, lang: 'english' | 'hindi' | 'hinglish'): string {
    if (proposal.actionType === 'UPDATE_ORDER_STATUS') {
      const fromStatus = proposal.currentOrderStatus || 'Confirmed';
      const toStatus = proposal.newOrderStatus || 'Dispatched';
      if (lang === 'hinglish') {
        return `Mujhe Order **#${proposal.orderNumber}** (${proposal.customerName}) mila.\n\n` +
          `**Proposed Action:**\n` +
          `• Order: #${proposal.orderNumber}\n` +
          `• Current Status: ${fromStatus}\n` +
          `• New Status: **${toStatus}**\n` +
          `• Customer Notification: Existing status update notification workflow will execute.\n\n` +
          `Kya aap confirm karna chahte hain ki Order #${proposal.orderNumber} ko **${toStatus}** mark kiya jaye?`;
      }
      return `I found Order **#${proposal.orderNumber}** (${proposal.customerName}).\n\n` +
        `**Proposed Action:**\n` +
        `• Order: #${proposal.orderNumber}\n` +
        `• Current Status: ${fromStatus}\n` +
        `• New Status: **${toStatus}**\n` +
        `• Customer Notification: Existing status update notification workflow will execute.\n\n` +
        `Please confirm: should I mark Order #${proposal.orderNumber} as **${toStatus}**?`;
    }

    if (proposal.actionType === 'INITIATE_REFUND') {
      const refundRupees = proposal.refundAmountCents ? Number((proposal.refundAmountCents / 100).toFixed(2)) : 0;
      return `I found Order **#${proposal.orderNumber}** (${proposal.customerName}).\n\n` +
        `**Proposed Action:**\n` +
        `• Order: #${proposal.orderNumber}\n` +
        `• Refund Amount: **${this.formatRupees(refundRupees)}**\n` +
        `• Current Status: ${proposal.currentOrderStatus}\n` +
        `• New Return Status: **Refund Initiated**\n` +
        `• Customer Notification: Existing refund initiation notification will be sent.\n\n` +
        `Please confirm: should I initiate a refund of **${this.formatRupees(refundRupees)}** for Order #${proposal.orderNumber}?`;
    }

    if (proposal.actionType === 'UPDATE_PRODUCT_PRICE') {
      const curRupees = proposal.originalPriceCents ? Number((proposal.originalPriceCents / 100).toFixed(2)) : 0;
      const newRupees = proposal.newPriceCents ? Number((proposal.newPriceCents / 100).toFixed(2)) : 0;
      return `I found product **${proposal.productName}**.\n\n` +
        `**Proposed Action:**\n` +
        `• Product: ${proposal.productName}\n` +
        `• Current Price: **${this.formatRupees(curRupees)}**\n` +
        `• New Price: **${this.formatRupees(newRupees)}**\n\n` +
        `Please confirm: should I change the price of ${proposal.productName} to **${this.formatRupees(newRupees)}**?`;
    }

    if (proposal.actionType === 'CANCEL_ORDER') {
      return `I found Order **#${proposal.orderNumber}** (${proposal.customerName}).\n\n` +
        `**Proposed Action:**\n` +
        `• Order: #${proposal.orderNumber}\n` +
        `• Current Status: ${proposal.currentOrderStatus}\n` +
        `• New Status: **Cancelled**\n` +
        `• Customer Notification: Existing cancellation notification workflow will run.\n\n` +
        `Please confirm: should I cancel Order #${proposal.orderNumber}?`;
    }

    // Deal proposal message
    const durationStr = this.formatDurationDisplay(proposal.durationValue || 2, proposal.durationUnit || 'days');
    const isBulk = proposal.isBulk || (proposal.affectedCartsList && proposal.affectedCartsList.length > 1);
    const cartsList = proposal.affectedCartsList || [];

    if (isBulk && cartsList.length > 0) {
      const cartsFormatted = cartsList
        .map((c, idx) => {
          const itemsStr = (c.items && c.items.length > 0)
            ? c.items.map((i: any) => `${i.productName} × ${i.quantity}`).join(', ')
            : c.productName;
          return `• Cart #${idx + 1} — ${itemsStr} — ${c.customerEmail}`;
        })
        .join('\n');

      return `I found **${cartsList.length} abandoned cart(s)**.\n\n` +
        `**${proposal.discountPercent || 10}% OFF** will be applied to:\n` +
        `${cartsFormatted}\n\n` +
        `Offer: **${proposal.discountPercent || 10}% OFF**\n` +
        `Expires: **${durationStr}**\n` +
        `Promotional Email: **${proposal.sendEmail ? 'Yes (to all affected customers)' : 'No'}**\n\n` +
        `Apply this offer to all ${cartsList.length} abandoned cart(s)?`;
    }

    // Single cart proposal message
    const targetCart = (cartsList.length === 1) ? cartsList[0] : null;
    const itemsList = targetCart?.items || [];
    const itemsFormatted = itemsList.length > 0
      ? itemsList.map((i: any) => `  • ${i.productName} × ${i.quantity} — ${this.formatRupees((i.originalPriceCents || 0) / 100)} each`).join('\n')
      : `  • ${proposal.productName || 'Product'}`;

    const originalRupees = proposal.originalPriceCents ? Number((proposal.originalPriceCents / 100).toFixed(2)) : undefined;
    const dealPriceRupees = proposal.dealPriceCents ? Number((proposal.dealPriceCents / 100).toFixed(2)) : undefined;

    return `I found **Abandoned Cart** (${targetCart?.customerEmail || proposal.eligibleCustomers?.[0]?.email || 'Customer'}).\n\n` +
      `**Action Proposal:**\n` +
      `• Scope: Entire Abandoned Cart\n` +
      `• Products in Cart:\n${itemsFormatted}\n` +
      (originalRupees ? `• Original Cart Total: **${this.formatRupees(originalRupees)}**\n` : '') +
      `• Discount: **${proposal.discountPercent || 10}% OFF**\n` +
      (dealPriceRupees ? `• Final Cart Total: **${this.formatRupees(dealPriceRupees)}**\n` : '') +
      `• Target Customer: ${targetCart?.customerEmail || proposal.eligibleCustomers?.[0]?.email || 'Customer'}\n` +
      `• Duration: **${durationStr}** (Original state restores automatically on expiration)\n` +
      `• Promotional Email: **${proposal.sendEmail ? 'Yes' : 'No'}**\n\n` +
      `Would you like me to confirm and execute this action?`;
  }

  /**
   * Full-Spectrum Grounded Context Retrieval for READ queries across Orders, Returns, Refunds, Payments, Carts, Products, Customers
   */
  private async retrieveGroundedContext(merchantId: string, userMessage: string): Promise<Record<string, any>> {
    const analytics = await this.analyticsService.getComprehensiveMerchantAnalytics(merchantId);
    const orderRepo = this.dataSource.getRepository(Order);
    const productRepo = this.dataSource.getRepository(Product);
    const timelineRepo = this.dataSource.getRepository(OrderTimeline);
    const paymentRepo = this.dataSource.getRepository(Payment);

    const context: Record<string, any> = {
      analytics_summary: {
        total_revenue: this.formatRupees(analytics.orders.total_revenue_rupees),
        revenue_at_risk: this.formatRupees(analytics.carts.revenue_at_risk_rupees),
        total_failed_payments: this.formatRupees(analytics.payments.total_failed_rupees),
        total_recovered_revenue: this.formatRupees(analytics.payments.total_recovered_rupees),
        average_order_value: this.formatRupees(analytics.orders.average_order_value_rupees),
        abandoned_carts_count: analytics.carts.abandoned_count,
        failed_payments_count: analytics.payments.failed_count,
        completed_orders_count: analytics.orders.completed_orders,
        pending_orders_count: analytics.orders.pending_orders,
        cancelled_orders_count: analytics.orders.cancelled_orders,
        returned_orders_count: analytics.orders.returned_orders,
      },
    };

    const lowerMsg = userMessage.toLowerCase();

    // 1. ORDERS & TIMELINE DETAILS
    if (lowerMsg.includes('order') || lowerMsg.includes('status') || lowerMsg.includes('timeline') || lowerMsg.includes('dispatched') || lowerMsg.includes('delivered') || lowerMsg.includes('tracking')) {
      const orders = await orderRepo.find({
        where: {},
        relations: ['items', 'items.product', 'customer'],
        order: { created_at: 'DESC' },
        take: 10,
      });

      context.recent_orders = await Promise.all(
        orders.map(async (o) => {
          const timeline = await timelineRepo.find({ where: { order_id: o.id }, order: { created_at: 'ASC' } });
          return {
            order_number: o.order_number,
            customer_name: o.customer?.name || 'Customer',
            customer_email: o.customer?.email || 'N/A',
            status: o.status,
            total: this.formatRupees(Number(o.total_cents) / 100),
            created_at: o.created_at,
            cancellation_reason: o.cancellation_reason || undefined,
            items: o.items?.map((i) => `${i.product?.name || 'Item'} × ${i.quantity}`) || [],
            timeline: timeline.map((t) => `${t.event_type} (${t.created_at.toISOString().split('T')[0]})`),
          };
        })
      );
    }

    // 2. RETURNS & REFUNDS DETAILS
    if (lowerMsg.includes('return') || lowerMsg.includes('refund') || lowerMsg.includes('reason') || lowerMsg.includes('wapas')) {
      const returnedOrders = await orderRepo.find({
        where: [
          { status: 'return_requested' },
          { status: 'return_approved' },
          { status: 'return_rejected' },
          { status: 'order_returned_to_seller' },
          { status: 'refund_initiated' },
        ],
        relations: ['items', 'items.product', 'customer'],
        order: { updated_at: 'DESC' },
        take: 10,
      });

      context.returns_and_refunds = returnedOrders.map((o) => ({
        order_number: o.order_number,
        customer_name: o.customer?.name || 'Customer',
        customer_email: o.customer?.email || 'N/A',
        status: o.status,
        return_status: o.return_status || o.status,
        return_reason: o.return_reason || 'Defective item or customer change of mind',
        refund_status: o.refund_status || (o.refund_initiated_at ? 'initiated' : 'none'),
        refund_amount: this.formatRupees(Number(o.refund_amount_cents || o.total_cents) / 100),
        returned_products: o.items?.map((i) => `${i.product?.name || 'Item'} × ${i.quantity}`) || [],
        return_requested_at: o.return_requested_at || o.created_at,
      }));
    }

    // 3. PAYMENTS & FAILURE REASONS
    if (lowerMsg.includes('fail') || lowerMsg.includes('payment') || lowerMsg.includes('reason')) {
      context.payment_failure_reasons = await this.analyticsService.getPaymentFailureReasons(merchantId);
      const failedPayments = await paymentRepo.find({
        where: { status: 'failed' },
        relations: ['order', 'order.customer'],
        order: { created_at: 'DESC' },
        take: 10,
      });

      context.recent_failed_payment_records = failedPayments.map((p) => ({
        payment_id: p.id,
        order_number: p.order?.order_number || 'N/A',
        customer_name: p.order?.customer?.name || 'Customer',
        amount: this.formatRupees(Number(p.amount_cents) / 100),
        failure_reason: p.failure_reason || 'Bank decline or authentication timeout',
        timestamp: p.created_at,
      }));
    }

    // 4. PRODUCT & INVENTORY LOOKUP
    const merchantProducts = await productRepo.find({
      where: [{ merchant_id: merchantId }, { merchant_id: IsNull() }],
    });

    let matchedProduct: Product | undefined;
    for (const p of merchantProducts) {
      if (lowerMsg.includes(p.name.toLowerCase())) {
        matchedProduct = p;
        break;
      }
    }

    if (!matchedProduct && (lowerMsg.includes('price') || lowerMsg.includes('cost') || lowerMsg.includes('kitne') || lowerMsg.includes('stock'))) {
      const words = lowerMsg.split(/\s+/).filter((w) => w.length > 2);
      for (const p of merchantProducts) {
        if (words.some((w) => p.name.toLowerCase().includes(w))) {
          matchedProduct = p;
          break;
        }
      }
    }

    if (matchedProduct) {
      const priceRupees = Number((Number(matchedProduct.price_cents) / 100).toFixed(2));
      context.queried_product = {
        id: matchedProduct.id,
        name: matchedProduct.name,
        price_cents: Number(matchedProduct.price_cents),
        price_rupees: priceRupees,
        price_formatted: this.formatRupees(priceRupees),
        original_price_rupees: matchedProduct.original_price_cents ? (Number(matchedProduct.original_price_cents) / 100).toFixed(2) : undefined,
        category: matchedProduct.category || 'General',
        description: matchedProduct.description || '',
      };
    }

    // 5. ABANDONED CARTS & ITEMS LOOKUP
    const cartRepo = this.dataSource.getRepository(Cart);
    const inactivityMinutes = process.env.CART_ABANDONMENT_MINUTES !== undefined
      ? parseInt(process.env.CART_ABANDONMENT_MINUTES, 10)
      : 5;
    const cutoffDate = new Date(Date.now() - inactivityMinutes * 60 * 1000);

    const abandonedCarts = await cartRepo
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.items', 'ci')
      .innerJoinAndSelect('ci.product', 'p')
      .leftJoinAndSelect('c.customer', 'cust')
      .where('(p.merchant_id = :merchantId OR p.merchant_id IS NULL)', { merchantId })
      .andWhere("c.status = 'abandoned' OR (c.status = 'active' AND c.updated_at <= :cutoffDate)", { cutoffDate })
      .orderBy('c.updated_at', 'DESC')
      .getMany();

    context.abandoned_carts_details = abandonedCarts.map((c, idx) => {
      const items = c.items || [];
      const totalCents = items.reduce((acc, it) => {
        const itemPrice = Number(it.product?.price_cents || it.price_cents || 0);
        return acc + itemPrice * (it.quantity || 1);
      }, 0);

      return {
        cart_index: idx + 1,
        cart_id: c.id,
        customer_id: c.customer_id,
        customer_name: c.customer?.name || 'Customer',
        customer_email: c.customer?.email || 'N/A',
        updated_at: c.updated_at,
        total_value: this.formatRupees(totalCents / 100),
        items: items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product?.name || 'Product',
          quantity: i.quantity,
          unit_price: this.formatRupees(Number(i.product?.price_cents || i.price_cents || 0) / 100),
        })),
      };
    });

    return context;
  }

  /**
   * Generate natural-language response using Groq
   */
  private async generateGroqResponse(
    merchantId: string,
    userMessage: string,
    contextData: Record<string, any>,
    langStyle: 'english' | 'hindi' | 'hinglish',
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;

    if (!apiKey || apiKey === 'placeholder-groq-key' || process.env.NODE_ENV === 'test') {
      return this.getFallbackGroundedResponse(userMessage, contextData, langStyle);
    }

    const systemPrompt = `You are a professional, accurate AI Merchant Operations Assistant for RazorShop.
STRICT GUIDELINES:
1. Base all answers strictly on the supplied REAL MERCHANT DATABASE CONTEXT. NEVER fabricate numbers, orders, products, prices, return reasons, or customers.
2. Abandoned-cart metrics and cart/product/customer records in this payload are the authoritative CURRENT database state. Do not infer, remember, or reuse abandoned carts from previous messages. If the payload says 0, answer 0.
3. The target cart/customer/product IDs supplied by the backend are authoritative. Never invent or reuse IDs from previous conversation turns.
4. If the data exists in context (recent_orders, returns_and_refunds, payment_failure_reasons, queried_product, abandoned_carts_details), answer directly. NEVER tell the merchant to visit another page or say data is unavailable if present.
5. OUTPUT CURRENCY FORMATTING: All monetary numbers MUST use the '₹' symbol (e.g. ₹3,492.22). NEVER output 'INR', 'cents', 'paise', 'USD', or raw unformatted numbers.
6. LANGUAGE MATCHING: Respond in the EXACT language style of the user prompt (English, Hindi, Hinglish).
7. Keep responses concise, clear, and direct.`;

    const userPrompt = `REAL MERCHANT DATABASE CONTEXT:
${JSON.stringify(contextData, null, 2)}

MERCHANT QUESTION:
${userMessage}`;

    try {
      const messagesPayload: any[] = [{ role: 'system', content: systemPrompt }];
      for (const h of history.slice(-10)) {
        messagesPayload.push({ role: h.role, content: h.content });
      }
      messagesPayload.push({ role: 'user', content: userPrompt });

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-120b',
          messages: messagesPayload,
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim()) {
          return content.trim();
        }
      }
    } catch (err) {
      console.warn('[MerchantHelperService] Groq API call failed, using fallback:', err);
    }

    return this.getFallbackGroundedResponse(userMessage, contextData, langStyle);
  }

  /**
   * Deterministic grounded fallback responses for tests/offline
   */
  private getFallbackGroundedResponse(
    userMessage: string,
    context: Record<string, any>,
    langStyle: 'english' | 'hindi' | 'hinglish'
  ): string {
    const summary = context.analytics_summary || {};
    const lower = userMessage.toLowerCase();

    // 0. Queried Product Price Question
    if (context.queried_product) {
      const p = context.queried_product;
      if (lower.includes('price') || lower.includes('cost') || lower.includes('kitne') || lower.includes('kitna')) {
        if (langStyle === 'hinglish') return `${p.name} ki current price ${p.price_formatted} hai.`;
        if (langStyle === 'hindi') return `${p.name} का वर्तमान मूल्य ${p.price_formatted} है।`;
        return `The current price of ${p.name} is ${p.price_formatted}.`;
      }
    }

    // 0B. Abandoned Carts Details Query
    if (lower.includes('abandon') || lower.includes('cart') || lower.includes('item') || lower.includes('value')) {
      if (context.abandoned_carts_details && context.abandoned_carts_details.length > 0) {
        const carts = context.abandoned_carts_details;
        const detailsList = carts.map((c: any) => {
          const itemsStr = c.items.map((i: any) => `${i.product_name} (×${i.quantity})`).join(', ') || 'No items';
          return `Cart #${c.cart_index} — ${itemsStr} — Customer: ${c.customer_name} (${c.customer_email}) — Value: ${c.total_value}`;
        });

        if (langStyle === 'hinglish') {
          return `Aapke store par total ${carts.length} abandoned cart(s) hain:\n\n` +
            detailsList.map((d: string) => `• ${d}`).join('\n');
        }
        if (langStyle === 'hindi') {
          return `आपकी दुकान में कुल ${carts.length} छोड़े गए कार्ट (abandoned carts) हैं:\n\n` +
            detailsList.map((d: string) => `• ${d}`).join('\n');
        }
        return `I found ${carts.length} abandoned cart(s) in your store records:\n\n` +
          detailsList.map((d: string) => `• ${d}`).join('\n');
      } else {
        return `There are currently 0 abandoned carts in your store records.`;
      }
    }

    // 1. Returns & Refunds Query
    if (lower.includes('return') || lower.includes('refund') || lower.includes('reason')) {
      if (context.returns_and_refunds && context.returns_and_refunds.length > 0) {
        const ret = context.returns_and_refunds[0];
        const count = context.returns_and_refunds.length;
        if (langStyle === 'hinglish') {
          return `Aapke total ${count} returned orders hain. Example Order #${ret.order_number} (${ret.customer_name}) return reason: "${ret.return_reason}". Refund Amount: ${ret.refund_amount}.`;
        }
        return `You have ${count} returned orders. Order #${ret.order_number} returned by ${ret.customer_name} due to "${ret.return_reason}". Total refund amount: ${ret.refund_amount}.`;
      }
      return `You have ${summary.returned_orders_count || 0} returned orders in your database records.`;
    }

    // 2. Failed Payments Query
    if (lower.includes('fail') || lower.includes('payment')) {
      const count = summary.failed_payments_count || 0;
      const total = summary.total_failed_payments || '₹0.00';
      if (langStyle === 'hinglish') {
        return count > 0
          ? `Aapke total ${count} failed payments hain jiska total amount ${total} hai.`
          : `Aapke store par filhal 0 failed payments hain. Transaction health achhi hai!`;
      }
      return count > 0
        ? `You have ${count} failed payment instances totaling ${total} at risk.`
        : `Your store currently has 0 failed payments. All payment attempts are processing cleanly!`;
    }

    // 3. Orders & Timeline Query
    if (lower.includes('order') || lower.includes('dispatched') || lower.includes('delivered')) {
      if (context.recent_orders && context.recent_orders.length > 0) {
        const ord = context.recent_orders[0];
        return `Order #${ord.order_number} (${ord.customer_name}) current status is '${ord.status}'. Total: ${ord.total}.`;
      }
      return `Total completed orders: ${summary.completed_orders_count || 0}, pending: ${summary.pending_orders_count || 0}.`;
    }

    // Default general response
    return `Based on your live store database, total revenue is ${summary.total_revenue || '₹0.00'} with ${summary.completed_orders_count || 0} completed orders and ${summary.abandoned_carts_count || 0} abandoned carts.`;
  }

  /**
   * Build structured deal action proposal grounded in real current database/cart contents
   */
  private async buildDealProposal(
    merchantId: string,
    userMessage: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<DealActionProposal | null> {
    const productRepo = this.dataSource.getRepository(Product);
    const cartRepo = this.dataSource.getRepository(Cart);

    const requestedDiscount = this.parseDiscount(userMessage) ?? 10;
    const durationObj = this.parseDuration(userMessage) || { durationValue: 2, durationUnit: 'days' as const, expiresInMinutes: 2880 };
    const sendEmail = this.parseEmailFlag(userMessage) ?? true;

    const merchantProducts = await productRepo.find({
      where: [{ merchant_id: merchantId }, { merchant_id: IsNull() }],
    });

    let targetProduct: Product | undefined;
    let hasExplicitProductMatch = false;
    const lowerMsg = userMessage.toLowerCase();

    for (const p of merchantProducts) {
      if (lowerMsg.includes(p.name.toLowerCase())) {
        targetProduct = p;
        hasExplicitProductMatch = true;
        break;
      }
    }

    let scope = this.parseScope(userMessage, hasExplicitProductMatch);
    if (!scope) {
      scope = hasExplicitProductMatch ? 'product' : 'cart';
    }

    const inactivityMinutes = process.env.CART_ABANDONMENT_MINUTES !== undefined
      ? parseInt(process.env.CART_ABANDONMENT_MINUTES, 10)
      : 5;
    const cutoffDate = new Date(Date.now() - inactivityMinutes * 60 * 1000);
    const abandonedCartRows = await cartRepo
      .createQueryBuilder('c')
      .select('c.id', 'cart_id')
      .addSelect('cust.id', 'customer_id')
      .addSelect('cust.name', 'customer_name')
      .addSelect('cust.email', 'customer_email')
      .addSelect('p.id', 'product_id')
      .addSelect('p.name', 'product_name')
      .addSelect('p.price_cents', 'product_price_cents')
      .addSelect('p.original_price_cents', 'product_original_price_cents')
      .addSelect('ci.quantity', 'quantity')
      .addSelect('ci.price_cents', 'item_price_cents')
      .innerJoin('cart_items', 'ci', 'ci.cart_id = c.id')
      .innerJoin('products', 'p', 'p.id = ci.product_id')
      .leftJoin('customers', 'cust', 'cust.id = c.customer_id')
      .where('(p.merchant_id = :merchantId OR p.merchant_id IS NULL)', { merchantId })
      .andWhere("c.status = 'abandoned' OR (c.status = 'active' AND c.updated_at <= :cutoffDate)", { cutoffDate })
      .getRawMany();

    const customerMap = new Map<string, { id: string; name?: string; email: string }>();
    const cartSet = new Set<string>();
    const cartItemsMap = new Map<string, { productId: string; productName: string; unitPriceCents: number; quantity: number; lineTotalCents: number }>();
    const affectedCartsMap = new Map<string, {
      cartId: string;
      customerId?: string;
      customerName: string;
      customerEmail: string;
      productId: string;
      productName: string;
      unitPriceCents: number;
      originalPriceCents: number;
      dealPriceCents: number;
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        originalPriceCents: number;
        dealPriceCents: number;
      }>;
      originalCartTotalCents: number;
      dealCartTotalCents: number;
    }>();

    let totalCartCents = 0;
    let totalUnitsCount = 0;

    for (const r of abandonedCartRows) {
      cartSet.add(r.cart_id);
      if (r.customer_id && !customerMap.has(r.customer_id)) {
        customerMap.set(r.customer_id, {
          id: r.customer_id,
          name: r.customer_name || 'Customer',
          email: r.customer_email || 'customer@example.com',
        });
      }

      const unitPriceCents = Number(r.product_original_price_cents || r.product_price_cents || r.item_price_cents);
      const qty = Number(r.quantity || 1);
      const lineTotal = unitPriceCents * qty;
      const dealPrice = Math.round(unitPriceCents * (1 - requestedDiscount / 100));

      totalCartCents += lineTotal;
      totalUnitsCount += qty;

      if (!cartItemsMap.has(r.product_id)) {
        cartItemsMap.set(r.product_id, {
          productId: r.product_id,
          productName: r.product_name,
          unitPriceCents,
          quantity: qty,
          lineTotalCents: lineTotal,
        });
      } else {
        const item = cartItemsMap.get(r.product_id)!;
        item.quantity += qty;
        item.lineTotalCents += lineTotal;
      }

      if (!affectedCartsMap.has(r.cart_id)) {
        affectedCartsMap.set(r.cart_id, {
          cartId: r.cart_id,
          customerId: r.customer_id,
          customerName: r.customer_name || 'Customer',
          customerEmail: r.customer_email || 'customer@example.com',
          productId: r.product_id,
          productName: r.product_name || 'Product',
          unitPriceCents,
          originalPriceCents: unitPriceCents,
          dealPriceCents: dealPrice,
          items: [{
            productId: r.product_id,
            productName: r.product_name || 'Product',
            quantity: qty,
            originalPriceCents: unitPriceCents,
            dealPriceCents: dealPrice,
          }],
          originalCartTotalCents: lineTotal,
          dealCartTotalCents: dealPrice * qty,
        });
      } else {
        const existingCart = affectedCartsMap.get(r.cart_id)!;
        existingCart.items.push({
          productId: r.product_id,
          productName: r.product_name || 'Product',
          quantity: qty,
          originalPriceCents: unitPriceCents,
          dealPriceCents: dealPrice,
        });
        existingCart.originalCartTotalCents += lineTotal;
        existingCart.dealCartTotalCents += dealPrice * qty;
      }
    }

    const eligibleCustomers = Array.from(customerMap.values());
    const cartInstancesCount = cartSet.size;
    const uniqueCustomersCount = eligibleCustomers.length;
    const cartItemsSummary = Array.from(cartItemsMap.values());
    const allCartsList = Array.from(affectedCartsMap.values());

    const isBulk = !userMessage.match(/#?([0-9a-f]{8}-[0-9a-f]{4}|cart\s*#?\d+)/i) &&
      (lowerMsg.includes('all') || lowerMsg.includes('saare') || lowerMsg.includes('sabhi') || lowerMsg.includes('every') || (allCartsList.length > 1 && (lowerMsg.includes('abandoned carts') || lowerMsg.includes('carts')) && !lowerMsg.includes('this cart') && !lowerMsg.includes('this abandoned cart')));

    let affectedCartsList = allCartsList;
    const refCartId = this.extractReferencedCartId(userMessage, history);

    if (!isBulk && allCartsList.length > 0) {
      if (refCartId) {
        const matched = allCartsList.find(
          (c, idx) => c.cartId.toLowerCase().includes(refCartId.toLowerCase()) || String(idx + 1) === refCartId
        );
        if (matched) {
          affectedCartsList = [matched];
        } else {
          affectedCartsList = [allCartsList[0]];
        }
      } else {
        affectedCartsList = [allCartsList[0]];
      }
    }

    if (!targetProduct && cartItemsSummary.length > 0) {
      const topCartProd = merchantProducts.find((p) => p.id === cartItemsSummary[0].productId);
      if (topCartProd) targetProduct = topCartProd;
    }

    if (!targetProduct && merchantProducts.length > 0) {
      targetProduct = merchantProducts[0];
    }

    let originalPriceCents: number | undefined;
    let dealPriceCents: number | undefined;

    if (scope === 'cart') {
      if (affectedCartsList.length === 1) {
        originalPriceCents = affectedCartsList[0].originalCartTotalCents;
        dealPriceCents = affectedCartsList[0].dealCartTotalCents;
      } else {
        originalPriceCents = totalCartCents > 0 ? totalCartCents : (targetProduct ? Number(targetProduct.price_cents) : 99900);
        const discountAmountCents = Math.round(originalPriceCents * (requestedDiscount / 100));
        dealPriceCents = originalPriceCents - discountAmountCents;
      }
    } else {
      if (targetProduct) {
        originalPriceCents = targetProduct.original_price_cents ? Number(targetProduct.original_price_cents) : Number(targetProduct.price_cents);
        dealPriceCents = Math.round(originalPriceCents * (1 - requestedDiscount / 100));
      }
    }

    return {
      proposalId: randomUUID(),
      actionType: 'CREATE_DEAL_AND_EMAIL',
      scope,
      productId: targetProduct?.id,
      productName: targetProduct?.name,
      originalPriceCents,
      discountPercent: requestedDiscount,
      dealPriceCents,
      isBulk,
      affectedCartsList,
      cartItemsSummary,
      durationValue: durationObj.durationValue,
      durationUnit: durationObj.durationUnit,
      expiresInMinutes: durationObj.expiresInMinutes,
      sendEmail,
      eligibleCustomers,
      cartInstancesCount: affectedCartsList.length,
      uniqueCustomersCount,
      totalUnitsCount,
    };
  }

  /**
   * Execute ANY action proposal after explicit merchant double confirmation
   */
  async executeActionProposal(
    merchantId: string,
    proposal: DealActionProposal
  ): Promise<HelperChatResponse> {
    const productRepo = this.dataSource.getRepository(Product);
    const auditRepo = this.dataSource.getRepository(AuditLog);

    // 1. ORDER STATUS UPDATE ACTION
    if (proposal.actionType === 'UPDATE_ORDER_STATUS' && proposal.orderId && proposal.newOrderStatus) {
      const updatedOrder = await this.orderService.updateOrderStatusByMerchant(
        proposal.orderId,
        merchantId,
        proposal.newOrderStatus
      );

      return {
        message: `Done! Order **#${updatedOrder.order_number}** status has been updated to **${updatedOrder.status}**. Timeline event recorded and customer notification workflow triggered.`,
        proposal: null,
        requiresConfirmation: false,
        actionExecuted: true,
        actionResult: {
          orderNumber: updatedOrder.order_number,
          newStatus: updatedOrder.status,
        },
      };
    }

    // 2. INITIATE REFUND ACTION
    if (proposal.actionType === 'INITIATE_REFUND' && proposal.orderId) {
      const refundedOrder = await this.orderService.initiateRefund(proposal.orderId, merchantId);
      const refundRupees = Number(refundedOrder.total_cents) / 100;

      return {
        message: `Done! Refund of **${this.formatRupees(refundRupees)}** for Order **#${refundedOrder.order_number}** has been initiated. Timeline event updated and refund notification email dispatched.`,
        proposal: null,
        requiresConfirmation: false,
        actionExecuted: true,
        actionResult: {
          orderNumber: refundedOrder.order_number,
          refundAmountRupees: refundRupees,
          newStatus: refundedOrder.status,
        },
      };
    }

    // 3. CANCEL ORDER ACTION
    if (proposal.actionType === 'CANCEL_ORDER' && proposal.orderId) {
      const cancelledOrder = await this.orderService.updateOrderStatusByMerchant(
        proposal.orderId,
        merchantId,
        'cancelled',
        'Cancelled by merchant via Merchant Helper'
      );

      return {
        message: `Done! Order **#${cancelledOrder.order_number}** has been cancelled. Timeline event recorded and cancellation email sent.`,
        proposal: null,
        requiresConfirmation: false,
        actionExecuted: true,
        actionResult: {
          orderNumber: cancelledOrder.order_number,
          newStatus: 'cancelled',
        },
      };
    }

    // 4. UPDATE PRODUCT PRICE ACTION
    if (proposal.actionType === 'UPDATE_PRODUCT_PRICE' && proposal.productId && proposal.newPriceCents) {
      const prod = await productRepo.findOne({
        where: [{ id: proposal.productId, merchant_id: merchantId }, { id: proposal.productId, merchant_id: IsNull() }],
      });
      if (!prod) throw new Error('Product not found or unauthorized');

      prod.price_cents = proposal.newPriceCents;
      await productRepo.save(prod);
      const newRupees = proposal.newPriceCents / 100;

      return {
        message: `Done! Product **${prod.name}** price has been updated to **${this.formatRupees(newRupees)}**.`,
        proposal: null,
        requiresConfirmation: false,
        actionExecuted: true,
        actionResult: {
          productName: prod.name,
          newPriceRupees: newRupees,
        },
      };
    }

    // 5. DEAL & PROMOTIONAL EMAIL ACTION
    const confirmedDiscount = proposal.discountPercent || 10;
    const expiresInMinutes = proposal.expiresInMinutes || 2880;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const durationDays = Math.ceil(expiresInMinutes / 1440);

    // Re-validate target carts from live DB before execution
    if (proposal.affectedCartsList && proposal.affectedCartsList.length > 0) {
      const cartRepo = this.dataSource.getRepository(Cart);
      const targetCartIds = proposal.affectedCartsList
        .map((c) => c.cartId)
        .filter((id) => id && id !== 'single');

      if (targetCartIds.length > 0) {
        const inactivityMinutes = process.env.CART_ABANDONMENT_MINUTES !== undefined
          ? parseInt(process.env.CART_ABANDONMENT_MINUTES, 10)
          : 5;
        const cutoffDate = new Date(Date.now() - inactivityMinutes * 60 * 1000);

        const liveCarts = await cartRepo
          .createQueryBuilder('c')
          .innerJoin('cart_items', 'ci', 'ci.cart_id = c.id')
          .innerJoin('products', 'p', 'p.id = ci.product_id')
          .where('c.id IN (:...targetCartIds)', { targetCartIds })
          .andWhere('(p.merchant_id = :merchantId OR p.merchant_id IS NULL)', { merchantId })
          .andWhere("c.status = 'abandoned' OR (c.status = 'active' AND c.updated_at <= :cutoffDate)", { cutoffDate })
          .getMany();

        if (liveCarts.length === 0) {
          return {
            message: 'The targeted abandoned cart(s) are no longer abandoned or active in the database. No deal action was executed.',
            proposal: null,
            requiresConfirmation: false,
            actionExecuted: false,
          };
        }
      }
    }

    const cartsToProcess = proposal.affectedCartsList && proposal.affectedCartsList.length > 0
      ? proposal.affectedCartsList
      : (proposal.productId ? [{
          cartId: proposal.targetCartId || 'single',
          customerId: proposal.eligibleCustomers?.[0]?.id,
          customerName: proposal.eligibleCustomers?.[0]?.name || 'Valued Customer',
          customerEmail: proposal.eligibleCustomers?.[0]?.email || '',
          productId: proposal.productId,
          productName: proposal.productName || 'Product',
          originalPriceCents: proposal.originalPriceCents || 0,
          dealPriceCents: proposal.dealPriceCents || 0,
        }] : []);

    let sentCount = 0;
    let failedCount = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    const executionLines: string[] = [];

    for (const c of cartsToProcess) {
      try {
        const itemsToProcess = (c.items && c.items.length > 0) ? c.items : [{
          productId: c.productId,
          productName: c.productName,
          originalPriceCents: c.originalPriceCents,
          dealPriceCents: c.dealPriceCents,
        }];

        const cartProductNames: string[] = [];

        for (const item of itemsToProcess) {
          if (!item.productId) continue;
          const prod = await productRepo.findOne({
            where: [{ id: item.productId, merchant_id: merchantId }, { id: item.productId, merchant_id: IsNull() }],
          });

          if (prod) {
            const currentPriceCents = Number(prod.price_cents);
            const origCents = prod.original_price_cents ? Number(prod.original_price_cents) : currentPriceCents;
            const dealCents = Math.round(origCents * (1 - confirmedDiscount / 100));

            prod.original_price_cents = origCents;
            prod.price_cents = dealCents;
            prod.discount_percent = confirmedDiscount;
            prod.deal_active = true;
            prod.deal_expires_at = expiresAt;
            await productRepo.save(prod);
            cartProductNames.push(prod.name);

            // Auto-expire timer setup
            const msUntilExpiration = expiresAt.getTime() - Date.now();
            if (msUntilExpiration > 0 && msUntilExpiration < 2147483647) {
              const timer = setTimeout(async () => {
                try {
                  await this.restoreExpiredDealPrice(prod.id);
                } catch (err) {
                  console.error('[MerchantHelperService] Error restoring deal expiration price:', err);
                }
              }, Math.max(50, msUntilExpiration));
              if (timer && typeof timer.unref === 'function') {
                timer.unref();
              }
            }
          }
        }

        if (cartProductNames.length > 0) {
          totalSucceeded++;
          executionLines.push(`✓ Cart — ${cartProductNames.join(', ')} (${c.customerEmail || 'Customer'})`);
        } else {
          totalFailed++;
        }

        // Send promotional email to specific customer of this cart
        if (proposal.sendEmail && c.customerEmail && c.customerEmail.includes('@')) {
          try {
            const origDisplay = (((c as any).originalCartTotalCents || c.originalPriceCents || 99900) / 100).toFixed(2);
            const dealDisplay = (((c as any).dealCartTotalCents || c.dealPriceCents || 59900) / 100).toFixed(2);
            const productListStr = cartProductNames.join(' & ') || c.productName || 'Entire Abandoned Cart Deal';
            const emailRes = await this.emailService.sendPromotionalDealEmail(
              c.customerEmail,
              c.customerName || 'Valued Customer',
              productListStr,
              origDisplay,
              dealDisplay,
              confirmedDiscount,
              durationDays
            );
            if (emailRes.success) sentCount++;
            else failedCount++;
          } catch {
            failedCount++;
          }
        }
      } catch (err: any) {
        totalFailed++;
        executionLines.push(`✗ Cart — ${c.productName} (${c.customerEmail}): ${err.message || 'Failed'}`);
      }
    }

    try {
      await auditRepo.save({
        event_type: 'merchant_manual_email_sent',
        entity_type: proposal.isBulk ? 'bulk_cart_deal' : (proposal.scope === 'product' ? 'product_deal' : 'cart_deal'),
        entity_id: merchantId,
        merchant_id: merchantId,
      });
    } catch {
      // Non-blocking log
    }

    const durationDisplay = this.formatDurationDisplay(proposal.durationValue || 2, proposal.durationUnit || 'days');
    const totalTargeted = cartsToProcess.length;

    let responseMsg = '';
    if (totalFailed === 0) {
      responseMsg = `Done.\n\n` +
        `**${confirmedDiscount}% OFF** was successfully applied to ${totalSucceeded} abandoned cart(s).\n\n` +
        executionLines.map((line) => `${line}`).join('\n') + `\n\n` +
        `• ${proposal.sendEmail ? sentCount : 0} customer(s) notified.\n` +
        `• Offer expires in **${durationDisplay}** (Original state will restore automatically on expiration).`;
    } else {
      responseMsg = `The **${confirmedDiscount}% OFF** offer was applied to ${totalSucceeded} of ${totalTargeted} abandoned cart(s).\n\n` +
        executionLines.map((line) => `${line}`).join('\n') + `\n\n` +
        `• ${proposal.sendEmail ? sentCount : 0} customer(s) notified.\n` +
        `• Offer expires in **${durationDisplay}**.`;
    }

    return {
      message: responseMsg,
      proposal: null,
      requiresConfirmation: false,
      actionExecuted: true,
      actionResult: {
        productName: proposal.isBulk ? 'All Abandoned Carts' : (proposal.productName || 'Entire Abandoned Cart'),
        scope: proposal.scope,
        discountPercent: confirmedDiscount,
        dealPriceRupees: proposal.dealPriceCents ? Number((proposal.dealPriceCents / 100).toFixed(2)) : undefined,
        eligibleCount: totalTargeted,
        emailsSentCount: proposal.sendEmail ? sentCount : 0,
        emailsFailedCount: failedCount,
        expiresInMinutes,
      },
    };
  }

  async executeDealAndEmailAction(merchantId: string, proposal: DealActionProposal): Promise<HelperChatResponse> {
    return this.executeActionProposal(merchantId, proposal);
  }

  /**
   * Restores original price on deal expiration with ZERO email dispatch
   */
  async restoreExpiredDealPrice(productId: string): Promise<boolean> {
    const freshRepo = this.dataSource.getRepository(Product);
    const freshProd = await freshRepo.findOne({ where: { id: productId } });
    if (freshProd && freshProd.original_price_cents) {
      freshProd.price_cents = Number(freshProd.original_price_cents);
      freshProd.original_price_cents = null as any;
      freshProd.discount_percent = null as any;
      freshProd.deal_active = false;
      freshProd.deal_expires_at = null as any;
      await freshRepo.save(freshProd);
      console.log(`[MerchantHelperService] Deal expired for product ${productId}. Original price restored to ₹${(freshProd.price_cents / 100).toFixed(2)}. NO emails sent.`);
      return true;
    }
    return false;
  }
}
