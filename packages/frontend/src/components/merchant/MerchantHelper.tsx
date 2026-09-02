import { useState, useRef, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import { IconSend, IconRefresh, IconCheck, IconClose } from '../common/Icons';

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
  productId?: string;
  productName?: string;
  originalPriceCents?: number;
  discountPercent?: number;
  dealPriceCents?: number;
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

  // Order / Refund / Return fields
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  customerEmail?: string;
  currentOrderStatus?: string;
  newOrderStatus?: string;
  currentReturnStatus?: string;
  newReturnStatus?: string;
  refundAmountCents?: number;

  // Product price / stock fields
  currentPriceCents?: number;
  newPriceCents?: number;
  currentStock?: number;
  newStock?: number;
  description?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  proposal?: DealActionProposal | null;
  requiresConfirmation?: boolean;
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

export default function MerchantHelper() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: 'Namaste! I am your AI Merchant Operations Assistant. Ask me anything about your orders, returns, refunds, failed payments, abandoned carts, products, or sales analytics in English, Hindi, or Hinglish. You can also instruct me to update order status, initiate refunds, or create custom deals.',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<DealActionProposal | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const suggestedQuestions = [
    'What were the reasons for returned orders?',
    'How many failed payments happened?',
    'Mark order #1234 as dispatched',
    'Initiate refund for order #1234',
    'Can we offer 10% off to abandoned cart customers?',
  ];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/merchant/helper/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({
          message: text.trim(),
          proposal: pendingProposal,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to get response from Merchant Helper');
      }

      const data = await response.json();

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        text: data.message,
        timestamp: new Date(),
        proposal: data.proposal,
        requiresConfirmation: data.requiresConfirmation,
        actionExecuted: data.actionExecuted,
        actionResult: data.actionResult,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setPendingProposal(data.proposal || null);
    } catch (err: any) {
      setError(err.message || 'An error occurred while communicating with Merchant Helper');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProposal = async (proposalToConfirm: DealActionProposal) => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/merchant/helper/action/confirm'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({
          proposal: proposalToConfirm,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to execute proposed action');
      }

      const data = await response.json();

      const confirmResultMsg: ChatMessage = {
        id: `msg-${Date.now() + 2}`,
        sender: 'assistant',
        text: data.message,
        timestamp: new Date(),
        actionExecuted: true,
        actionResult: data.actionResult,
      };

      setMessages((prev) => [...prev, confirmResultMsg]);
      setPendingProposal(null);
    } catch (err: any) {
      setError(err.message || 'Failed to execute proposed action');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelProposal = () => {
    setPendingProposal(null);
    const cancelMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: 'Action proposal cancelled. Is there anything else I can help you with?',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  };

  const formatDurationDisplay = (val?: number, unit?: string) => {
    if (!val || !unit) return '2 days';
    if (unit === 'minutes') return `${val} minute${val > 1 ? 's' : ''}`;
    if (unit === 'hours') return `${val} hour${val > 1 ? 's' : ''}`;
    return `${val} day${val > 1 ? 's' : ''}`;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-5xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white px-6 py-4 flex items-center justify-between shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="text-lg font-bold tracking-tight">Merchant Operations Assistant</h2>
            <span className="bg-blue-500/30 text-blue-100 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              AI Operations
            </span>
          </div>
          <p className="text-xs text-blue-100 mt-0.5">
            Full-spectrum database intelligence & operational execution in English, Hindi, and Hinglish.
          </p>
        </div>
      </div>

      {/* Suggested Chips Header */}
      <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 overflow-x-auto flex items-center gap-2 text-xs">
        <span className="font-bold text-gray-500 shrink-0">Suggestions:</span>
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            disabled={loading}
            className="shrink-0 bg-white hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-300 px-3 py-1 rounded-full font-medium transition cursor-pointer disabled:opacity-50 text-xs"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-5 py-3.5 text-xs leading-relaxed shadow-xs ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white font-medium rounded-tr-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none whitespace-pre-wrap'
              }`}
            >
              {msg.text}

              {/* Action Result Card */}
              {msg.actionExecuted && msg.actionResult && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-sans">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                    <IconCheck className="w-4 h-4 text-emerald-600" />
                    <span>Action Successfully Executed</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[11px] mt-2">
                    {msg.actionResult.orderNumber && <div><span className="font-semibold">Order:</span> #{msg.actionResult.orderNumber}</div>}
                    {msg.actionResult.newStatus && <div><span className="font-semibold">Status:</span> {msg.actionResult.newStatus}</div>}
                    {msg.actionResult.productName && <div><span className="font-semibold">Product:</span> {msg.actionResult.productName}</div>}
                    {msg.actionResult.discountPercent && <div><span className="font-semibold">Discount:</span> {msg.actionResult.discountPercent}% OFF</div>}
                    {msg.actionResult.dealPriceRupees && <div><span className="font-semibold">Deal Price:</span> ₹{msg.actionResult.dealPriceRupees.toFixed(2)}</div>}
                    {msg.actionResult.refundAmountRupees && <div><span className="font-semibold">Refund Initiated:</span> ₹{msg.actionResult.refundAmountRupees.toFixed(2)}</div>}
                  </div>
                </div>
              )}

              {/* Action Proposal Confirmation Card */}
              {msg.proposal && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 font-sans shadow-xs">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-2 mb-3">
                    <span className="font-bold text-amber-900 text-sm">⚡ Action Ready for Double Confirmation</span>
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded">Action Pending</span>
                  </div>

                  <div className="space-y-1.5 text-xs mb-4">
                    {msg.proposal.orderNumber && (
                      <div><span className="font-bold text-gray-700">Order:</span> #{msg.proposal.orderNumber}</div>
                    )}
                    {msg.proposal.customerName && (
                      <div><span className="font-bold text-gray-700">Customer:</span> {msg.proposal.customerName} ({msg.proposal.customerEmail || 'N/A'})</div>
                    )}
                    {msg.proposal.currentOrderStatus && (
                      <div><span className="font-bold text-gray-700">Current Status:</span> {msg.proposal.currentOrderStatus}</div>
                    )}
                    {msg.proposal.newOrderStatus && (
                      <div><span className="font-bold text-gray-700">Requested Status:</span> <span className="font-bold text-blue-800">{msg.proposal.newOrderStatus}</span></div>
                    )}
                    {msg.proposal.refundAmountCents && (
                      <div><span className="font-bold text-gray-700">Refund Amount:</span> <span className="font-bold text-emerald-800">₹{(msg.proposal.refundAmountCents / 100).toFixed(2)}</span></div>
                    )}
                    {msg.proposal.productName && (
                      <div><span className="font-bold text-gray-700">Product:</span> {msg.proposal.productName}</div>
                    )}
                    {msg.proposal.currentPriceCents && (
                      <div><span className="font-bold text-gray-700">Current Price:</span> ₹{(msg.proposal.currentPriceCents / 100).toFixed(2)}</div>
                    )}
                    {msg.proposal.newPriceCents && (
                      <div><span className="font-bold text-gray-700">New Price:</span> <span className="font-bold text-blue-800">₹{(msg.proposal.newPriceCents / 100).toFixed(2)}</span></div>
                    )}
                    {msg.proposal.discountPercent && (
                      <div><span className="font-bold text-gray-700">Discount:</span> <span className="font-bold text-emerald-700">{msg.proposal.discountPercent}% OFF</span></div>
                    )}
                    {msg.proposal.dealPriceCents && (
                      <div><span className="font-bold text-gray-700">Deal Price:</span> <span className="font-extrabold text-blue-800">₹{(msg.proposal.dealPriceCents / 100).toFixed(2)}</span></div>
                    )}
                    {msg.proposal.durationValue && (
                      <div><span className="font-bold text-gray-700">Duration:</span> <span className="font-bold text-indigo-700">{formatDurationDisplay(msg.proposal.durationValue, msg.proposal.durationUnit)}</span></div>
                    )}
                    <div className="text-[11px] text-amber-800 mt-1 italic">
                      🔔 Notification: Relevant existing email and timeline workflows will execute automatically upon confirmation.
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleConfirmProposal(msg.proposal!)}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <IconCheck className="w-4 h-4" />
                      <span>Confirm & Execute Action</span>
                    </button>
                    <button
                      onClick={handleCancelProposal}
                      disabled={loading}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                    >
                      <IconClose className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <span className="text-[10px] text-gray-400 mt-1 px-1">
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-gray-500 text-xs bg-white border border-gray-200 rounded-2xl rounded-tl-none px-4 py-3 w-fit">
            <IconRefresh className="w-4 h-4 animate-spin text-blue-600" />
            <span>Merchant Operations Assistant is processing live database metrics...</span>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => handleSendMessage()}
              className="font-bold underline cursor-pointer ml-2"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Footer */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-3"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask questions or instruct actions (e.g. 'Mark order #1234 as dispatched', 'Initiate refund')..."
            disabled={loading}
            className="flex-1 bg-gray-50 border border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none rounded-xl px-4 py-2.5 text-xs text-gray-800 transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Send</span>
            <IconSend className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
