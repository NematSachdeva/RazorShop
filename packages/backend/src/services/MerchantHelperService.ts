import { DataSource, IsNull } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { AnalyticsService, isUuid } from './AnalyticsService.js';
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
  returnReason?: string;
  orderAmountCents?: number;
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
    // Deal fields (canonical — use products array, not productName)
    products?: string[];           // All product names affected by the deal
    productName?: string;          // Legacy single-product field (kept for compatibility)
    originalTotalRupees?: number;  // Original cart/product total before discount
    dealTotalRupees?: number;      // Final total after discount
    cartId?: string;               // Target cart ID
    customerEmail?: string;        // Customer who received the deal
    customerName?: string;         // Customer name
    expiresAt?: string;            // ISO timestamp of deal expiration

    // Order / refund fields
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
    const directMatch = userMessage.match(/(?:order|order\s*#|order\s*no\.?|order\s*number)\s*#?\s*([A-Za-z0-9-]+)/i) ||
                        userMessage.match(/#([A-Za-z0-9-]+)/i) ||
                        userMessage.match(/#?(ORD-[A-Za-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (directMatch) {
      const val = directMatch[1].replace('#', '').trim();
      const ignoreWords = ['dispatched', 'delivered', 'cancelled', 'cancel', 'refund', 'status', 'the', 'details', 'for', 'a', 'this'];
      if (val.length >= 2 && !ignoreWords.includes(val.toLowerCase())) {
        return val;
      }
    }

    for (let i = history.length - 1; i >= 0; i--) {
      const match = history[i].content.match(/(?:order|order\s*#|order\s*no\.?|order\s*number)\s*#?\s*([A-Za-z0-9-]+)/i) ||
                    history[i].content.match(/#([A-Za-z0-9-]+)/i) ||
                    history[i].content.match(/#?(ORD-[A-Za-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (match) {
        const val = match[1].replace('#', '').trim();
        const ignoreWords = ['dispatched', 'delivered', 'cancelled', 'cancel', 'refund', 'status', 'the', 'details', 'for', 'a', 'this'];
        if (val.length >= 2 && !ignoreWords.includes(val.toLowerCase())) {
          return val;
        }
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
      message: this.sanitizeMarkdownFormatting(answer),
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
      const matchRes = await this.findMatchingMerchantOrder(merchantId, userMessage, history);
      if (matchRes.status === 'NOT_FOUND' && matchRes.searchedRef) {
        return `I couldn't find order #${matchRes.searchedRef} in your store records. Please check the order number and try again.`;
      }
      if (matchRes.status === 'AMBIGUOUS' && matchRes.candidates) {
        const listText = matchRes.candidates.map((c, i) => `${i + 1}. #${c.order_number} (${c.customer?.name || 'Customer'})`).join('\n');
        return `I found multiple orders matching '${matchRes.searchedRef}':\n\n${listText}\n\nWhich order number would you like to mark as Dispatched?`;
      }
      const order = matchRes.order;
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
      const matchRes = await this.findMatchingMerchantOrder(merchantId, userMessage, history);
      if (matchRes.status === 'NOT_FOUND' && matchRes.searchedRef) {
        return `I couldn't find order #${matchRes.searchedRef} in your store records. Please check the order number and try again.`;
      }
      if (matchRes.status === 'AMBIGUOUS' && matchRes.candidates) {
        const listText = matchRes.candidates.map((c, i) => `${i + 1}. #${c.order_number} (${c.customer?.name || 'Customer'})`).join('\n');
        return `I found multiple orders matching '${matchRes.searchedRef}':\n\n${listText}\n\nWhich order number would you like to mark as Delivered?`;
      }
      const order = matchRes.order;
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
      const matchRes = await this.findMatchingMerchantOrder(merchantId, userMessage, history);
      if (matchRes.status === 'NOT_FOUND' && matchRes.searchedRef) {
        return `I couldn't find order #${matchRes.searchedRef} in your store records. Please check the order number and try again.`;
      }
      if (matchRes.status === 'AMBIGUOUS' && matchRes.candidates) {
        const listText = matchRes.candidates.map((c, i) => `${i + 1}. #${c.order_number} (${c.customer?.name || 'Customer'})`).join('\n');
        return `I found multiple orders matching '${matchRes.searchedRef}':\n\n${listText}\n\nWhich order number would you like to cancel?`;
      }
      const order = matchRes.order;
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
      const matchRes = await this.findMatchingMerchantOrder(merchantId, userMessage, history);
      if (matchRes.status === 'NOT_FOUND' && matchRes.searchedRef) {
        return `I couldn't find order #${matchRes.searchedRef} in your store records. Please check the order number and try again.`;
      }
      if (matchRes.status === 'AMBIGUOUS' && matchRes.candidates) {
        const listText = matchRes.candidates.map((c, i) => `${i + 1}. #${c.order_number} (${c.customer?.name || 'Customer'})`).join('\n');
        return `I found multiple orders matching '${matchRes.searchedRef}':\n\n${listText}\n\nWhich order number would you like to initiate a refund for?`;
      }
      const order = matchRes.order;
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

    // 1DD. Return Actions (Accept/Approve Return or Reject/Decline Return)
    const isAcceptReturn = /accept|approve|haan|misaal|pass/i.test(lower) && (lower.includes('return') || lower.includes('wapas') || lower.includes('wali') || lower.includes('one'));
    const isRejectReturn = /reject|decline|radd|cancel/i.test(lower) && (lower.includes('return') || lower.includes('wapas') || lower.includes('wali') || lower.includes('one'));

    const isReturnActionIntent = (isAcceptReturn || isRejectReturn) ||
      (lower.includes('return') && (lower.includes('accept') || lower.includes('approve') || lower.includes('reject') || lower.includes('decline'))) ||
      ((lower.includes('is return ko') || lower.includes('return request ko') || lower.includes('this return') || lower.includes('the return')) && (lower.includes('accept') || lower.includes('approve') || lower.includes('reject') || lower.includes('decline')));

    if (isReturnActionIntent) {
      const isAccept = lower.includes('accept') || lower.includes('approve') || lower.includes('haan') || (isAcceptReturn && !isRejectReturn);
      const matchRes = await this.findMatchingReturnRequestOrder(merchantId, userMessage, history);

      if (matchRes.status === 'NOT_FOUND') {
        return matchRes.searchedRef
          ? `I couldn't find a pending return request for order #${matchRes.searchedRef} in your store records.`
          : `There are currently 0 pending return requests in your store records.`;
      }

      if (matchRes.status === 'AMBIGUOUS' && matchRes.candidates) {
        const listText = matchRes.candidates.map((c, i) => `${i + 1}. #${c.order_number} (${c.customer?.name || 'Customer'}) — Reason: "${c.return_reason || 'N/A'}"`).join('\n');
        const verb = isAccept ? 'accept' : 'reject';
        return `I found multiple pending return requests:\n\n${listText}\n\nWhich order number would you like to ${verb}?`;
      }

      const order = matchRes.order;
      if (order) {
        const newReturnStatus = isAccept ? 'return_approved' : 'return_rejected';
        const verbName = isAccept ? 'Approve' : 'Reject';

        return {
          proposalId: randomUUID(),
          actionType: 'PROCESS_RETURN',
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.customer?.name || 'Customer',
          customerEmail: order.customer?.email || 'N/A',
          currentReturnStatus: order.return_status || 'return_requested',
          newReturnStatus,
          returnReason: order.return_reason || undefined,
          orderAmountCents: Number(order.total_cents),
          description: `${verbName} Return Request for Order ${order.order_number}`,
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
    const isDealIntent = /deal|offer|discount|off|coupon|percent|%|samose|expire|minute|hour|day|kal tak|mail|email|bhej|wanna|other cart|dusra cart|dusri cart|other|another/i.test(userMessage);

    const isOtherCart = lower.includes('other cart') || lower.includes('dusra cart') || lower.includes('dusri cart') || lower.includes('another cart');

    if (pendingProposal && isOtherCart) {
      return this.buildDealProposal(merchantId, userMessage, history, pendingProposal);
    }

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
      const prop = await this.buildDealProposal(merchantId, userMessage, history, pendingProposal);
      if (!prop) {
        return "There are currently 0 abandoned carts, so there are no customers to target with this deal.";
      }
      if (prop.proposalId === 'EXACT_CART_NOT_FOUND') {
        return "I couldn't find that cart in your merchant account. I have not created or changed any deal.";
      }
      if (prop.proposalId.startsWith('INVALID_CART_INDEX:')) {
        const invalidIdx = prop.proposalId.split(':')[1];
        return `I couldn't resolve Cart #${invalidIdx} from the current abandoned-cart list. Let me refresh the abandoned-cart data first.`;
      }
      if (prop.proposalId.startsWith('AMBIGUOUS_CART_REF:')) {
        const listText = prop.proposalId.replace('AMBIGUOUS_CART_REF:', '');
        return `I found multiple abandoned carts matching that description. Which one do you mean?\n\n${listText}`;
      }
      if (prop.affectedCartsList && prop.affectedCartsList.length === 0 && prop.scope === 'cart') {
        return "There are currently 0 abandoned carts, so there are no customers to target with this deal.";
      }
      return prop;
    }

    return null;
  }

  /**
   * Helper to find matching order by order number, ID, or recent order
   */
  /**
   * Helper to find matching order by order number, ID, or recent order
   */
  private async findMatchingMerchantOrder(
    merchantId: string,
    text: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<{ status: 'FOUND' | 'NOT_FOUND' | 'AMBIGUOUS'; order?: Order; candidates?: Order[]; searchedRef?: string }> {
    const orderRepo = this.dataSource.getRepository(Order);
    const refNum = this.extractReferencedOrderNumber(text, history);

    if (refNum) {
      const cleaned = refNum.replace('#', '').trim();

      const qb = orderRepo.createQueryBuilder('o')
        .innerJoin('o.items', 'item')
        .innerJoin('item.product', 'product')
        .leftJoinAndSelect('o.items', 'items')
        .leftJoinAndSelect('items.product', 'p')
        .leftJoinAndSelect('o.customer', 'customer')
        .where('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)', { merchantId });

      // 1. Try exact matches first
      const exactQb = qb.clone().andWhere(
        "(o.order_number = :exact OR o.order_number = :ordExact OR o.order_number = :hashExact" +
        (isUuid(cleaned) ? " OR o.id = :exact" : "") + ")",
        { exact: cleaned, ordExact: `ORD-${cleaned}`, hashExact: `#${cleaned}` }
      );
      const exactOrders = await exactQb.getMany();

      if (exactOrders.length === 1) {
        return { status: 'FOUND', order: exactOrders[0], searchedRef: cleaned };
      }
      if (exactOrders.length > 1) {
        return { status: 'AMBIGUOUS', candidates: exactOrders, searchedRef: cleaned };
      }

      // 2. Try partial matches
      const partialQb = qb.clone().andWhere("o.order_number ILIKE :likeRef", { likeRef: `%${cleaned}%` });
      const partialOrders = await partialQb.getMany();

      if (partialOrders.length === 1) {
        return { status: 'FOUND', order: partialOrders[0], searchedRef: cleaned };
      }
      if (partialOrders.length > 1) {
        return { status: 'AMBIGUOUS', candidates: partialOrders, searchedRef: cleaned };
      }

      return { status: 'NOT_FOUND', searchedRef: cleaned };
    }

    // If NO explicit order reference was given in prompt or history
    const qb = orderRepo.createQueryBuilder('o')
      .innerJoin('o.items', 'item')
      .innerJoin('item.product', 'product')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.product', 'p')
      .leftJoinAndSelect('o.customer', 'customer')
      .where('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)', { merchantId })
      .orderBy('o.created_at', 'DESC');

    const recentOrders = await qb.take(2).getMany();
    if (recentOrders.length === 1) {
      return { status: 'FOUND', order: recentOrders[0] };
    }
    if (recentOrders.length > 1) {
      return { status: 'FOUND', order: recentOrders[0] };
    }

    return { status: 'NOT_FOUND' };
  }

  /**
   * Helper to find matching order with a pending return request (return_status = 'return_requested' OR status = 'return_requested')
   */
  private async findMatchingReturnRequestOrder(
    merchantId: string,
    text: string,
    history: Array<{ role: string; content: string }> = []
  ): Promise<{ status: 'FOUND' | 'NOT_FOUND' | 'AMBIGUOUS'; order?: Order; candidates?: Order[]; searchedRef?: string }> {
    const orderRepo = this.dataSource.getRepository(Order);
    const lower = text.toLowerCase();

    const getPendingQuery = () => {
      return orderRepo.createQueryBuilder('o')
        .innerJoin('o.items', 'item')
        .innerJoin('item.product', 'product')
        .leftJoinAndSelect('o.items', 'items')
        .leftJoinAndSelect('items.product', 'p')
        .leftJoinAndSelect('o.customer', 'customer')
        .where('(product.merchant_id = :merchantId OR product.merchant_id IS NULL)', { merchantId })
        .andWhere("(o.return_status = 'return_requested' OR o.status = 'return_requested')")
        .orderBy('o.return_requested_at', 'DESC')
        .addOrderBy('o.updated_at', 'DESC');
    };

    // 1. Explicit order reference (#1234 or ORD-xxx or UUID)
    const refNum = this.extractReferencedOrderNumber(text, history);
    if (refNum) {
      const cleaned = refNum.replace('#', '').trim();
      const qb = getPendingQuery().andWhere(
        "(o.order_number = :exact OR o.order_number = :ordExact OR o.order_number = :hashExact OR o.order_number ILIKE :likeRef" +
        (isUuid(cleaned) ? " OR o.id = :exact" : "") + ")",
        { exact: cleaned, ordExact: `ORD-${cleaned}`, hashExact: `#${cleaned}`, likeRef: `%${cleaned}%` }
      );
      const matched = await qb.getMany();
      if (matched.length === 1) return { status: 'FOUND', order: matched[0], searchedRef: cleaned };
      if (matched.length > 1) return { status: 'AMBIGUOUS', candidates: matched, searchedRef: cleaned };
    }

    // 2. Explicit index/ordinal ("second", "2nd", "2", "first", "1st", "1", "second wali", "2nd return")
    const pendingOrders = await getPendingQuery().getMany();
    if (pendingOrders.length === 0) {
      return { status: 'NOT_FOUND' };
    }

    let targetIdx: number | null = null;
    if (lower.includes('second') || lower.includes('2nd') || lower.includes('dusra') || lower.includes('dusri') || lower.includes('cart 2') || lower.includes('order 2') || lower.includes('number 2') || lower.includes('no 2')) {
      targetIdx = 1; // 0-indexed: 2nd item
    } else if (lower.includes('first') || lower.includes('1st') || lower.includes('pehla') || lower.includes('pehle') || lower.includes('cart 1') || lower.includes('order 1') || lower.includes('number 1') || lower.includes('no 1')) {
      targetIdx = 0; // 0-indexed: 1st item
    } else {
      const numMatch = lower.match(/(?:number|no|no\.|order|return|wali|one)\s*#?\s*(\d+)/i) ||
                       lower.match(/(\d+)(?:st|nd|rd|th)\s*(?:one|wali|return)?/i);
      if (numMatch) {
        const val = parseInt(numMatch[1], 10);
        if (!isNaN(val) && val >= 1 && val <= pendingOrders.length) {
          targetIdx = val - 1;
        }
      }
    }

    if (targetIdx !== null && targetIdx >= 0 && targetIdx < pendingOrders.length) {
      return { status: 'FOUND', order: pendingOrders[targetIdx] };
    }

    // 3. Fallback: If exactly 1 pending return request exists in live DB, resolve to that!
    if (pendingOrders.length === 1) {
      return { status: 'FOUND', order: pendingOrders[0] };
    }

    // 4. Multiple pending return requests exist and no specific index was specified -> AMBIGUOUS
    return { status: 'AMBIGUOUS', candidates: pendingOrders };
  }

  /**
   * Parse explicit cart reference (index, ordinal, UUID, or "other") from user message or history
   */
  private parseCartReference(
    userMessage: string,
    history: Array<{ role: string; content: string }> = []
  ): { type: 'uuid' | 'index' | 'other'; value?: string | number } | null {
    const lower = userMessage.toLowerCase();

    // 1. Explicit UUID
    const uuidMatch = userMessage.match(/#?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (uuidMatch) {
      return { type: 'uuid', value: uuidMatch[1] };
    }

    // 2. Direct cart number / index match: cart 1, cart #1, cart number 1, cart no 1, 1st cart, second cart, etc.
    const directNumMatch = lower.match(/(?:cart|cart\s*#|cart\s*number|cart\s*no\.?)\s*(\d+)/i) ||
                           lower.match(/(\d+)(?:st|nd|rd|th)\s*cart/i);
    if (directNumMatch) {
      return { type: 'index', value: parseInt(directNumMatch[1], 10) };
    }

    if (lower.includes('first cart') || lower.includes('1st cart') || lower.includes('pehla cart') || lower.includes('pehle cart')) {
      return { type: 'index', value: 1 };
    }
    if (lower.includes('second cart') || lower.includes('2nd cart') || lower.includes('dusra cart') || lower.includes('dusre cart')) {
      return { type: 'index', value: 2 };
    }
    if (lower.includes('third cart') || lower.includes('3rd cart') || lower.includes('teesra cart') || lower.includes('teesre cart')) {
      return { type: 'index', value: 3 };
    }

    if (lower.includes('other cart') || lower.includes('another cart') || lower.includes('dusri cart')) {
      return { type: 'other' };
    }

    // 3. Fallback: Check ONLY recent USER messages (NOT assistant messages) for explicit index.
    // We must NOT pick up cart numbers from old assistant responses, which would cause stale targeting.
    const recentUserMessages = history.filter((h) => h.role === 'user').slice(-3);
    for (let i = recentUserMessages.length - 1; i >= 0; i--) {
      const hContent = recentUserMessages[i].content;
      const hUuidMatch = hContent.match(/#?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      if (hUuidMatch) return { type: 'uuid', value: hUuidMatch[1] };

      const hIdxMatch = hContent.match(/(?:cart|cart\s*#|cart\s*number|cart\s*no\.?)\s*(\d+)/i);
      if (hIdxMatch) return { type: 'index', value: parseInt(hIdxMatch[1], 10) };
    }

    return null;
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

    if (proposal.actionType === 'PROCESS_RETURN') {
      const isApprove = proposal.newReturnStatus === 'return_approved';
      const actionTitle = isApprove ? 'Approve Return' : 'Reject Return';
      const orderAmountRupees = proposal.orderAmountCents ? Number((proposal.orderAmountCents / 100).toFixed(2)) : undefined;

      if (lang === 'hinglish') {
        return `Mujhe Order **#${proposal.orderNumber}** (${proposal.customerName}) ki return request mili.\n\n` +
          `**Proposed Action:**\n` +
          `• Order: #${proposal.orderNumber}\n` +
          `• Customer: ${proposal.customerName} (${proposal.customerEmail || 'N/A'})\n` +
          (proposal.returnReason ? `• Return Reason: "${proposal.returnReason}"\n` : '') +
          (orderAmountRupees ? `• Order Amount: **${this.formatRupees(orderAmountRupees)}**\n` : '') +
          `• Current Return Status: ${proposal.currentReturnStatus || 'return_requested'}\n` +
          `• New Return Status: **${isApprove ? 'return_approved' : 'return_rejected'}** (${actionTitle})\n` +
          `• Customer Notification: Return status notification email will be sent automatically.\n\n` +
          `Kya aap confirm karna chahte hain ki Order #${proposal.orderNumber} ki return request ko **${isApprove ? 'Accept' : 'Reject'}** kiya jaye?`;
      }
      return `I found the return request for Order **#${proposal.orderNumber}** (${proposal.customerName}).\n\n` +
        `**Proposed Action:**\n` +
        `• Order: #${proposal.orderNumber}\n` +
        `• Customer: ${proposal.customerName} (${proposal.customerEmail || 'N/A'})\n` +
        (proposal.returnReason ? `• Return Reason: "${proposal.returnReason}"\n` : '') +
        (orderAmountRupees ? `• Order Amount: **${this.formatRupees(orderAmountRupees)}**\n` : '') +
        `• Current Return Status: ${proposal.currentReturnStatus || 'return_requested'}\n` +
        `• New Return Status: **${isApprove ? 'return_approved' : 'return_rejected'}** (${actionTitle})\n` +
        `• Customer Notification: Return status notification email will be sent automatically.\n\n` +
        `Please confirm: should I **${isApprove ? 'Approve/Accept' : 'Reject'}** the return request for Order #${proposal.orderNumber}?`;
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
    if (lowerMsg.includes('return') || lowerMsg.includes('refund') || lowerMsg.includes('reason') || lowerMsg.includes('wapas') || lowerMsg.includes('वापसी')) {
      // Pending Return Requests specifically (return_status = 'return_requested' OR status = 'return_requested')
      const pendingReturnOrders = await orderRepo.find({
        where: [
          { return_status: 'return_requested' },
          { status: 'return_requested' },
        ],
        relations: ['items', 'items.product', 'customer'],
        order: { updated_at: 'DESC' },
        take: 10,
      });

      context.pending_return_requests_details = pendingReturnOrders.map((o, idx) => ({
        return_index: idx + 1,
        order_id: o.id,
        order_number: o.order_number,
        customer_name: o.customer?.name || 'Customer',
        customer_email: o.customer?.email || 'N/A',
        status: 'Return Requested',
        return_status: o.return_status || 'return_requested',
        reason: o.return_reason || 'No reason provided',
        order_amount: this.formatRupees(Number(o.total_cents) / 100),
        order_amount_cents: Number(o.total_cents),
        items: o.items?.map((i) => `${i.product?.name || 'Item'} ×${i.quantity}`) || [],
        requested_at: o.return_requested_at || o.updated_at,
      }));

      context.analytics_summary.pending_return_requests_count = context.pending_return_requests_details.length;

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

    // 4. PRODUCT & INVENTORY LOOKUP (Skip for Return/Cart queries to prevent misrouting)
    const isReturnQuery = lowerMsg.includes('return') || lowerMsg.includes('wapas') || lowerMsg.includes('वापसी');
    if (!isReturnQuery) {
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
    }

    // 5. ABANDONED CARTS & ITEMS LOOKUP (Canonical Source of Truth)
    const canonicalCarts = await this.analyticsService.getAbandonedCartsCanonical(merchantId);

    context.abandoned_carts_details = canonicalCarts.carts.map((c, idx) => ({
      cart_index: idx + 1,
      cart_id: c.cartId,
      customer_id: c.customerId,
      customer_name: c.customerName,
      customer_email: c.customerEmail,
      updated_at: c.updatedAt,
      total_value: this.formatRupees(c.cartTotalCents / 100),
      total_value_cents: c.cartTotalCents,
      items: c.items.map((i) => ({
        product_id: i.productId,
        product_name: i.productName,
        quantity: i.quantity,
        unit_price: this.formatRupees(i.unitPriceCents / 100),
        unit_price_cents: i.unitPriceCents,
      })),
    }));

    // IMPORTANT: The AI-facing abandoned_carts_count must equal the number of records in
    // abandoned_carts_details. The analytics_summary.abandoned_carts_count may include
    // pending orders (for analytics dashboard use), so we override it here with the
    // authoritative unique cart record count to prevent count/details mismatch.
    context.analytics_summary.abandoned_carts_count = context.abandoned_carts_details.length;
    context.analytics_summary.abandoned_carts_details_count = context.abandoned_carts_details.length;

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
You are grounded exclusively in the current store data returned by backend tools/APIs. NEVER invent records, IDs, customers, products, quantities, prices, totals, counts, statuses, or emails. If the required data is not returned by the backend, say that the data is unavailable instead of guessing.

STRICT GUIDELINES:
1. Base ALL answers strictly on the supplied REAL MERCHANT DATABASE CONTEXT payload below. NEVER fabricate or infer data.
2. ABANDONED CART COUNT = the length of 'abandoned_carts_details' array in the context. This is the authoritative current number. If 'abandoned_carts_details' is empty, there are ZERO abandoned carts — say zero. Do NOT use 'abandoned_carts_count' from analytics_summary as the definitive cart count if it differs.
3. Do NOT infer, remember, or carry over abandoned cart data from previous conversation messages. Every question must be answered from the CURRENT payload.
4. If a backend field is null, zero, or absent — answer that value. NEVER substitute with assumptions from memory.
5. The target cart/customer/product IDs supplied by the backend are authoritative. Never reuse IDs from previous conversation turns.
6. If the data exists in context (recent_orders, returns_and_refunds, payment_failure_reasons, queried_product, abandoned_carts_details), answer directly from it. NEVER say data is unavailable if it is present in the payload.
7. OUTPUT CURRENCY FORMATTING: All monetary numbers MUST use the '₹' symbol (e.g. ₹3,492.22). NEVER output 'INR', 'cents', 'paise', 'USD', or raw unformatted numbers.
8. LANGUAGE MATCHING: Respond in the EXACT language style of the user prompt (English, Hindi, Hinglish).
9. Keep responses concise, clear, and direct.
10. ONE ABANDONED CART RECORD = ONE ABANDONED CART regardless of how many products/items are inside it. Count carts, NOT products.
11. MARKDOWN FORMATTING RULES:
   - Use bold formatting (**...**) ONLY for key data points: numbers, monetary amounts, percentages, order/cart IDs, statuses, and specific value labels.
   - Do NOT bold section headers like 'Action:' or entire sentences/bullets unnecessarily.
   - NEVER output dangling '**' or standalone '* **' lines or unclosed formatting tags.`;

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
          return this.sanitizeMarkdownFormatting(content.trim());
        }
      }
    } catch (err) {
      console.warn('[MerchantHelperService] Groq API call failed, using fallback:', err);
    }

    return this.getFallbackGroundedResponse(userMessage, contextData, langStyle);
  }

  /**
   * Presentation/response-formatting cleanup for Markdown in Merchant Helper responses.
   * Removes dangling `**`, `* **`, unnecessary bolding on ordinary header labels like `**Action:**`,
   * and repairs unmatched bold delimiters while keeping important values/numbers/statuses bold.
   */
  public sanitizeMarkdownFormatting(text: string): string {
    if (!text) return text;
    let cleaned = text;

    // 1. Remove standalone dangling bullet bold lines (e.g. "* **", "- **")
    cleaned = cleaned.replace(/^[ \t]*[*|-][ \t]*\*\*[ \t]*$/gm, '');

    // 2. Remove standalone dangling ** lines
    cleaned = cleaned.replace(/^[ \t]*\*\*[ \t]*$/gm, '');

    // 3. Unbold plain section headers like **Action:** or **Recommended Actions:** or **Next Steps:**
    cleaned = cleaned.replace(/\*\*(Action|Actions|Recommended Action|Recommended Actions|Note|Summary|Next Steps|Details|Overview):\*\*/gi, '$1:');

    // 4. Remove dangling ** at end of lines or end of string
    cleaned = cleaned.replace(/\*\*\s*$/g, '');

    // 5. Ensure balanced ** count (repair unmatched bold tags)
    const count = (cleaned.match(/\*\*/g) || []).length;
    if (count % 2 !== 0) {
      const lastIdx = cleaned.lastIndexOf('**');
      if (lastIdx !== -1) {
        cleaned = cleaned.substring(0, lastIdx) + cleaned.substring(lastIdx + 2);
      }
    }

    // 6. Normalize multiple empty newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    return cleaned.trim();
  }

  /**
   * Deterministic grounded fallback responses for tests/offline
   */
  private getFallbackGroundedResponse(
    userMessage: string,
    context: Record<string, any>,
    langStyle: 'english' | 'hindi' | 'hinglish'
  ): string {
    return this.sanitizeMarkdownFormatting(this.buildFallbackGroundedResponseText(userMessage, context, langStyle));
  }

  private buildFallbackGroundedResponseText(
    userMessage: string,
    context: Record<string, any>,
    langStyle: 'english' | 'hindi' | 'hinglish'
  ): string {
    const summary = context.analytics_summary || {};
    const lower = userMessage.toLowerCase();

    // 0. Return Requests Query (pending return_requested status specifically)
    const isReturnReqQuery = (
      lower.includes('return request') ||
      lower.includes('returns requested') ||
      lower.includes('pending return') ||
      lower.includes('return aayi') ||
      lower.includes('kitne return') ||
      lower.includes('kitni return') ||
      lower.includes('number of return') ||
      lower.includes('how many return')
    ) || (
      lower.includes('return') &&
      !lower.includes('returned') &&
      !lower.includes('reason') &&
      !lower.includes('refund') &&
      !lower.includes('accept') &&
      !lower.includes('reject') &&
      !lower.includes('approve') &&
      !lower.includes('decline')
    );
    if (isReturnReqQuery && !lower.includes('accept') && !lower.includes('reject') && !lower.includes('approve') && !lower.includes('decline')) {
      const details = context.pending_return_requests_details || [];
      const count = details.length;

      if (count === 0) {
        if (langStyle === 'hinglish') return `Aapke store par filhal 0 pending return requests hain.`;
        if (langStyle === 'hindi') return `आपकी दुकान में वर्तमान में 0 लंबित रिटर्न अनुरोध (pending return requests) हैं।`;
        return `You have 0 pending return requests.`;
      }

      const formattedDetails = details.map((r: any) => {
        const itemsStr = Array.isArray(r.items) && r.items.length > 0 ? r.items.join(', ') : 'Item';
        return `• Order: #${r.order_number}\n` +
          `  Customer: ${r.customer_name} (${r.customer_email})\n` +
          `  Items: ${itemsStr}\n` +
          `  Order Amount: ${r.order_amount}\n` +
          `  Reason: ${r.reason}\n` +
          `  Status: Return Requested`;
      }).join('\n\n');

      if (langStyle === 'hinglish') {
        return `Aapke paas ${count} pending return request(s) aayi hai:\n\n${formattedDetails}`;
      }
      if (langStyle === 'hindi') {
        return `आपके पास ${count} लंबित रिटर्न अनुरोध हैं:\n\n${formattedDetails}`;
      }
      return `You have ${count} pending return request${count > 1 ? 's' : ''}.\n\n${formattedDetails}`;
    }

    // 0B. Queried Product Price Question (Only if NOT a return query)
    if (context.queried_product && !isReturnReqQuery) {
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
    history: Array<{ role: string; content: string }> = [],
    pendingProposal: DealActionProposal | null = null
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

    const canonical = await this.analyticsService.getAbandonedCartsCanonical(merchantId);

    const customerMap = new Map<string, { id: string; name?: string; email: string }>();
    const cartItemsMap = new Map<string, { productId: string; productName: string; unitPriceCents: number; quantity: number; lineTotalCents: number }>();
    const affectedCartsMap = new Map<string, any>();

    let totalCartCents = 0;

    for (const c of canonical.carts) {
      if (c.customerId && !customerMap.has(c.customerId)) {
        customerMap.set(c.customerId, {
          id: c.customerId,
          name: c.customerName,
          email: c.customerEmail,
        });
      }

      totalCartCents += c.cartTotalCents;

      const itemsFormatted = c.items.map((i: any) => {
        const dealPrice = Math.round(i.unitPriceCents * (1 - requestedDiscount / 100));

        if (!cartItemsMap.has(i.productId)) {
          cartItemsMap.set(i.productId, {
            productId: i.productId,
            productName: i.productName,
            unitPriceCents: i.unitPriceCents,
            quantity: i.quantity,
            lineTotalCents: i.lineTotalCents,
          });
        } else {
          const item = cartItemsMap.get(i.productId)!;
          item.quantity += i.quantity;
          item.lineTotalCents += i.lineTotalCents;
        }

        return {
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          originalPriceCents: i.unitPriceCents,
          dealPriceCents: dealPrice,
        };
      });

      const dealCartTotalCents = Math.round(c.cartTotalCents * (1 - requestedDiscount / 100));

      affectedCartsMap.set(c.cartId, {
        cartId: c.cartId,
        customerId: c.customerId,
        customerName: c.customerName,
        customerEmail: c.customerEmail,
        productId: c.items[0]?.productId,
        productName: c.items[0]?.productName,
        unitPriceCents: c.items[0]?.unitPriceCents || 0,
        originalPriceCents: c.cartTotalCents,
        dealPriceCents: dealCartTotalCents,
        items: itemsFormatted,
        originalCartTotalCents: c.cartTotalCents,
        dealCartTotalCents: dealCartTotalCents,
      });
    }

    const eligibleCustomers = Array.from(customerMap.values());
    const cartInstancesCount = canonical.uniqueCartInstancesCount;
    const uniqueCustomersCount = canonical.uniqueCustomersCount;
    const totalUnitsCount = canonical.totalUnitsCount;
    const cartItemsSummary = Array.from(cartItemsMap.values());
    const allCartsList = Array.from(affectedCartsMap.values());

    const isBulk = !userMessage.match(/#?([0-9a-f]{8}-[0-9a-f]{4}|cart\s*#?\d+)/i) &&
      (lowerMsg.includes('all') || lowerMsg.includes('saare') || lowerMsg.includes('sabhi') || lowerMsg.includes('every') || (allCartsList.length > 1 && (lowerMsg.includes('abandoned carts') || lowerMsg.includes('carts')) && !lowerMsg.includes('this cart') && !lowerMsg.includes('this abandoned cart')));

    let affectedCartsList = allCartsList;

    const refMatch = this.parseCartReference(userMessage, history);

    if (refMatch && refMatch.type === 'uuid') {
      const exactUuid = String(refMatch.value).toLowerCase();
      const matched = allCartsList.find((c) => c.cartId.toLowerCase() === exactUuid);
      if (!matched) {
        return {
          proposalId: 'EXACT_CART_NOT_FOUND',
          actionType: 'CREATE_DEAL_AND_EMAIL',
          scope,
          discountPercent: requestedDiscount,
          affectedCartsList: [],
        };
      }
      affectedCartsList = [matched];
    } else if (refMatch && refMatch.type === 'index') {
      const idx = (refMatch.value as number) - 1;
      if (idx >= 0 && idx < allCartsList.length) {
        affectedCartsList = [allCartsList[idx]];
      } else {
        return {
          proposalId: `INVALID_CART_INDEX:${refMatch.value}`,
          actionType: 'CREATE_DEAL_AND_EMAIL',
          scope,
          discountPercent: requestedDiscount,
          affectedCartsList: [],
        };
      }
    } else if (!isBulk && allCartsList.length > 0) {
      const isOther = (refMatch && refMatch.type === 'other') || lowerMsg.includes('other cart') || lowerMsg.includes('dusra cart') || lowerMsg.includes('dusri cart') || lowerMsg.includes('another cart');

      if (isOther && allCartsList.length > 1) {
        // Resolve "the other cart" by checking previous targeted cart ID
        let prevCartId: string | null = null;
        for (let i = history.length - 1; i >= 0; i--) {
          const m = history[i].content.match(/#?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
          if (m) { prevCartId = m[1]; break; }
        }
        if (prevCartId) {
          const otherCart = allCartsList.find((c) => c.cartId.toLowerCase() !== prevCartId!.toLowerCase());
          if (otherCart) affectedCartsList = [otherCart];
          else affectedCartsList = [allCartsList[0]];
        } else {
          affectedCartsList = [allCartsList[1]];
        }
      } else {
        // Try matching product name or customer name
        let matchedByProduct: typeof allCartsList = [];
        for (const c of allCartsList) {
          const hasProd = c.items.some((i: any) => lowerMsg.includes(i.productName.toLowerCase()));
          if (hasProd) matchedByProduct.push(c);
        }

        if (matchedByProduct.length === 1) {
          affectedCartsList = matchedByProduct;
        } else if (matchedByProduct.length > 1) {
          const listStr = matchedByProduct.map((c, idx) => {
            const itemsStr = c.items.map((i: any) => `${i.productName} × ${i.quantity}`).join(' + ');
            return `${idx + 1}. Cart #${idx + 1} — ${itemsStr} — ${this.formatRupees(c.originalCartTotalCents / 100)}`;
          }).join('\n');
          return {
            proposalId: `AMBIGUOUS_CART_REF:${listStr}`,
            actionType: 'CREATE_DEAL_AND_EMAIL',
            scope,
            affectedCartsList: [],
          };
        } else {
          let matchedByCustomer: typeof allCartsList = [];
          for (const c of allCartsList) {
            if (c.customerName && lowerMsg.includes(c.customerName.toLowerCase())) {
              matchedByCustomer.push(c);
            }
          }
          if (matchedByCustomer.length === 1) {
            affectedCartsList = matchedByCustomer;
          } else if (pendingProposal && pendingProposal.affectedCartsList && pendingProposal.affectedCartsList.length === 1) {
            const prevId = pendingProposal.affectedCartsList[0].cartId;
            const matchedPrev = allCartsList.find((c) => c.cartId.toLowerCase() === prevId.toLowerCase());
            if (matchedPrev) affectedCartsList = [matchedPrev];
            else affectedCartsList = [allCartsList[0]];
          } else {
            affectedCartsList = [allCartsList[0]];
          }
        }
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

    // 4B. PROCESS RETURN ACTION (Approve/Accept or Reject/Decline Return)
    if (proposal.actionType === 'PROCESS_RETURN' && proposal.orderId) {
      if (proposal.newReturnStatus === 'return_approved') {
        const updated = await this.orderService.approveReturn(proposal.orderId, merchantId);
        return {
          message: `Done! Return request for Order **#${updated.order_number}** has been approved successfully. Customer notification email sent and order timeline updated.`,
          proposal: null,
          requiresConfirmation: false,
          actionExecuted: true,
          actionResult: {
            orderNumber: updated.order_number,
            newStatus: 'return_approved',
          },
        };
      } else if (proposal.newReturnStatus === 'return_rejected') {
        const updated = await this.orderService.rejectReturn(proposal.orderId, merchantId, proposal.description);
        return {
          message: `Done! Return request for Order **#${updated.order_number}** has been rejected successfully. Customer notification email sent and order timeline updated.`,
          proposal: null,
          requiresConfirmation: false,
          actionExecuted: true,
          actionResult: {
            orderNumber: updated.order_number,
            newStatus: 'return_rejected',
          },
        };
      }
    }

    // 5. DEAL & PROMOTIONAL EMAIL ACTION
    const confirmedDiscount = proposal.discountPercent || 10;
    const expiresInMinutes = proposal.expiresInMinutes || 2880;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const durationDays = Math.ceil(expiresInMinutes / 1440);

    // Re-validate target carts from live DB before execution
    if (proposal.affectedCartsList && proposal.affectedCartsList.length > 0) {
      const targetCartIds = proposal.affectedCartsList
        .map((c) => c.cartId)
        .filter((id) => id && id !== 'single');

      if (targetCartIds.length > 0) {
        const canonical = await this.analyticsService.getAbandonedCartsCanonical(merchantId);
        const liveCartIds = new Set(canonical.carts.map((c) => c.cartId));
        const isValid = targetCartIds.some((id) => liveCartIds.has(id));

        if (!isValid) {
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
    let singleCartResult: {
      products: string[];
      originalTotalRupees?: number;
      dealTotalRupees?: number;
      cartId?: string;
      customerEmail?: string;
      customerName?: string;
    } | undefined;

    for (const c of cartsToProcess) {
      try {
        const itemsToProcess = (c.items && c.items.length > 0) ? c.items : [{
          productId: c.productId,
          productName: c.productName,
          originalPriceCents: c.originalPriceCents,
          dealPriceCents: c.dealPriceCents,
        }];

        const cartProductNames: string[] = [];
        let cartOriginalTotalCents = (c as any).originalCartTotalCents || c.originalPriceCents || 0;
        let cartDealTotalCents = 0;

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

            // Accumulate cart deal total from per-item deal prices
            const qty = (item as any).quantity || 1;
            cartDealTotalCents += dealCents * qty;

            // Use displayName with quantity (e.g. "Power Strip × 7")
            const qtyDisplay = qty > 1 ? ` × ${qty}` : '';
            cartProductNames.push(`${prod.name}${qtyDisplay}`);

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

        // If we couldn't compute cart total from items, use proposal fallback
        if (cartOriginalTotalCents === 0 && cartProductNames.length > 0) {
          cartOriginalTotalCents = (c as any).originalCartTotalCents || c.originalPriceCents || 0;
        }
        if (cartDealTotalCents === 0 && cartOriginalTotalCents > 0) {
          cartDealTotalCents = Math.round(cartOriginalTotalCents * (1 - confirmedDiscount / 100));
        }

        if (cartProductNames.length > 0) {
          totalSucceeded++;
          executionLines.push(`✓ Cart (${c.cartId || 'cart'}) — ${cartProductNames.join(', ')} (${c.customerEmail || 'Customer'})`);
        } else {
          totalFailed++;
        }

        // Accumulate first single-cart data for actionResult (single-cart scenario)
        if (cartsToProcess.length === 1) {
          singleCartResult = {
            products: cartProductNames,
            originalTotalRupees: cartOriginalTotalCents > 0 ? Number((cartOriginalTotalCents / 100).toFixed(2)) : undefined,
            dealTotalRupees: cartDealTotalCents > 0 ? Number((cartDealTotalCents / 100).toFixed(2)) : undefined,
            cartId: c.cartId || undefined,
            customerEmail: c.customerEmail || undefined,
            customerName: c.customerName || undefined,
          };
        }

        // Send promotional email to specific customer of this cart
        if (proposal.sendEmail && c.customerEmail && c.customerEmail.includes('@')) {
          try {
            const origDisplay = (cartOriginalTotalCents / 100).toFixed(2);
            const dealDisplay = (cartDealTotalCents / 100).toFixed(2);
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
        const cartLabel = (c as any).cartId || c.productName || 'cart';
        executionLines.push(`✗ ${cartLabel} (${c.customerEmail}): ${err.message || 'Failed'}`);
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

    // Build actionResult: use actual executed product names from singleCartResult when available
    const allExecutedProducts = executionLines
      .filter((l) => l.startsWith('✓'))
      .flatMap((l) => {
        const match = l.match(/^✓ Cart \(.*?\) — (.+?) \(/);
        return match ? match[1].split(', ') : [];
      });

    return {
      message: responseMsg,
      proposal: null,
      requiresConfirmation: false,
      actionExecuted: true,
      actionResult: {
        // Canonical products list (actual executed names, including quantities)
        products: singleCartResult?.products || (allExecutedProducts.length > 0 ? allExecutedProducts : undefined),
        productName: singleCartResult?.products?.join(', ') || (proposal.isBulk ? 'All Abandoned Carts' : 'Entire Abandoned Cart'),
        originalTotalRupees: singleCartResult?.originalTotalRupees,
        dealTotalRupees: singleCartResult?.dealTotalRupees,
        cartId: singleCartResult?.cartId,
        customerEmail: singleCartResult?.customerEmail,
        customerName: singleCartResult?.customerName,
        expiresAt: expiresAt.toISOString(),
        scope: proposal.scope,
        discountPercent: confirmedDiscount,
        dealPriceRupees: singleCartResult?.dealTotalRupees || (proposal.dealPriceCents ? Number((proposal.dealPriceCents / 100).toFixed(2)) : undefined),
        originalPriceRupees: singleCartResult?.originalTotalRupees || (proposal.originalPriceCents ? Number((proposal.originalPriceCents / 100).toFixed(2)) : undefined),
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
