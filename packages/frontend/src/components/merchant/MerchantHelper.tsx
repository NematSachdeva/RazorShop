import { useState, useRef, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import { IconSend, IconRefresh, IconCheck, IconClose } from '../common/Icons';
import { FormattedMarkdownText } from './FormattedMarkdownText';

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
  returnReason?: string;
  orderAmountCents?: number;
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
    // Deal fields (canonical — use products array)
    products?: string[];          // All product names affected (with qty, e.g. 'Power Strip × 7')
    productName?: string;         // Legacy fallback
    originalTotalRupees?: number; // Original cart total before discount
    dealTotalRupees?: number;     // Final total after discount
    cartId?: string;              // Affected cart ID
    customerEmail?: string;       // Customer email
    customerName?: string;        // Customer name
    expiresAt?: string;           // ISO expiration timestamp

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

const LOCAL_STORAGE_KEY = 'merchant_helper_chat_history';

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome-1',
  sender: 'assistant',
  text: 'Namaste! I am your AI Merchant Operations Assistant. Ask me anything about your orders, returns, refunds, failed payments, abandoned carts, products, or sales analytics in English, Hindi, or Hinglish. You can also instruct me to update order status, initiate refunds, or create custom deals.',
  timestamp: new Date(),
};

export default function MerchantHelper() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
        }
      }
    } catch {
      // Fallback to default
    }
    return [DEFAULT_WELCOME_MSG];
  });

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<DealActionProposal | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Speech-to-text voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Text-to-speech audio states
  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const [loadingTtsMsgId, setLoadingTtsMsgId] = useState<string | null>(null);
  const [ttsErrorMap, setTtsErrorMap] = useState<Record<string, string>>({});

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedAudioMap = useRef<Map<string, { audio: string; mimeType: string }>>(new Map());

  // Cleanup playing audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleToggleTTS = async (msg: ChatMessage) => {
    // If clicking on currently playing message -> stop audio
    if (playingMsgId === msg.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingMsgId(null);
      return;
    }

    // Stop any previously playing audio first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingMsgId(null);
    }

    // Clear previous error for this message
    setTtsErrorMap((prev) => {
      const next = { ...prev };
      delete next[msg.id];
      return next;
    });

    try {
      let audioData = cachedAudioMap.current.get(msg.id);

      if (!audioData) {
        setLoadingTtsMsgId(msg.id);
        const response = await fetch(getApiUrl('/merchant/helper/tts'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authService.getAuthHeader(),
          },
          body: JSON.stringify({ text: msg.text }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to generate voice audio');
        }

        const data = await response.json();
        audioData = { audio: data.audio, mimeType: data.mimeType || 'audio/wav' };
        cachedAudioMap.current.set(msg.id, audioData);
      }

      const sound = new Audio(`data:${audioData.mimeType};base64,${audioData.audio}`);
      audioRef.current = sound;
      setPlayingMsgId(msg.id);

      sound.onended = () => {
        setPlayingMsgId(null);
        audioRef.current = null;
      };

      sound.onerror = () => {
        setPlayingMsgId(null);
        audioRef.current = null;
        setTtsErrorMap((prev) => ({ ...prev, [msg.id]: 'Playback failed' }));
      };

      await sound.play();
    } catch (err: any) {
      console.error('TTS generation error:', err);
      setTtsErrorMap((prev) => ({ ...prev, [msg.id]: err.message || 'Audio unavailable' }));
    } finally {
      setLoadingTtsMsgId(null);
    }
  };

  const handleStartRecording = async () => {
    setVoiceError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setVoiceError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) {
          setVoiceError('No speech detected in audio. Please try recording again.');
          return;
        }

        await processAudioTranscription(audioBlob, mimeType);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      console.error('[MerchantHelper] Microphone access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission was denied. Please allow microphone access in browser settings.');
      } else {
        setVoiceError('Failed to access microphone. Please try typing your message.');
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const processAudioTranscription = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    setVoiceError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          const token = authService.getToken();
          const response = await fetch(getApiUrl('/merchant/helper/transcribe'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              audio: base64Data,
              mimeType,
            }),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || 'Speech transcription failed');
          }

          const data = await response.json();
          if (data.text && data.text.trim()) {
            setInputText((prev) => (prev.trim() ? `${prev.trim()} ${data.text.trim()}` : data.text.trim()));
          } else {
            setVoiceError('No speech detected. Please try again.');
          }
        } catch (err: any) {
          console.error('[MerchantHelper] Speech transcription error:', err);
          setVoiceError(err.message || 'Speech transcription failed. Please try again.');
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err: any) {
      console.error('[MerchantHelper] Audio processing error:', err);
      setVoiceError('Failed to process audio recording.');
      setIsTranscribing(false);
    }
  };

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

  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
      }
    } catch {
      // Storage save fallback
    }
  }, [messages]);

  const handleClearChat = () => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // Ignore
    }
    setMessages([DEFAULT_WELCOME_MSG]);
    setPendingProposal(null);
    setError(null);
    setShowClearConfirm(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setLoading(true);
    setError(null);

    // Extract recent 5 exchanges (max 10 messages) to send as context
    const historyPayload = updatedMessages
      .filter((m) => m.id !== 'welcome-1' && (m.sender === 'user' || m.sender === 'assistant'))
      .slice(-10)
      .map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

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
          history: historyPayload,
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

        <button
          onClick={() => setShowClearConfirm(true)}
          className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg transition font-medium cursor-pointer"
          title="Clear chat history"
        >
          <span>🗑️</span>
          <span>Clear Chat</span>
        </button>
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
            <div className="flex items-start gap-2 max-w-2xl">
              <div
                className={`rounded-2xl px-5 py-3.5 text-xs leading-relaxed shadow-xs flex-1 ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white font-medium rounded-tr-none whitespace-pre-wrap'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
                }`}
              >
                {msg.sender === 'user' ? (
                  msg.text
                ) : (
                  <FormattedMarkdownText content={msg.text} />
                )}

                {/* Action Result Card */}
                {msg.actionExecuted && msg.actionResult && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-sans">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                      <IconCheck className="w-4 h-4 text-emerald-600" />
                      <span>Action Successfully Executed</span>
                    </div>
                    <div className="space-y-1 text-[11px] mt-2">
                      {/* Order result */}
                      {msg.actionResult.orderNumber && <div><span className="font-semibold">Order:</span> #{msg.actionResult.orderNumber}</div>}
                      {msg.actionResult.newStatus && <div><span className="font-semibold">Status:</span> {msg.actionResult.newStatus}</div>}
                      {msg.actionResult.refundAmountRupees && <div><span className="font-semibold">Refund Initiated:</span> ₹{msg.actionResult.refundAmountRupees.toFixed(2)}</div>}

                      {/* Deal result — products array takes priority over legacy productName */}
                      {msg.actionResult.discountPercent && (
                        <div><span className="font-semibold">Discount:</span> <span className="font-bold text-emerald-700">{msg.actionResult.discountPercent}% OFF</span></div>
                      )}
                      {msg.actionResult.cartId && (
                        <div><span className="font-semibold">Cart ID:</span> <span className="font-mono text-[10px] text-gray-600">{msg.actionResult.cartId}</span></div>
                      )}
                      {msg.actionResult.customerEmail && (
                        <div><span className="font-semibold">Customer:</span> {msg.actionResult.customerName || ''} ({msg.actionResult.customerEmail})</div>
                      )}
                      {/* Products list (canonical) */}
                      {msg.actionResult.products && msg.actionResult.products.length > 0 ? (
                        <div>
                          <span className="font-semibold">Products Discounted:</span>
                          <ul className="ml-3 mt-0.5 list-disc list-inside space-y-0.5">
                            {msg.actionResult.products.map((p, i) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                      ) : (
                        msg.actionResult.productName && !msg.actionResult.orderNumber && (
                          <div><span className="font-semibold">Products:</span> {msg.actionResult.productName}</div>
                        )
                      )}
                      {msg.actionResult.originalTotalRupees && (
                        <div><span className="font-semibold">Original Total:</span> <span className="line-through text-gray-500">₹{msg.actionResult.originalTotalRupees.toFixed(2)}</span></div>
                      )}
                      {msg.actionResult.dealTotalRupees && (
                        <div><span className="font-semibold">Deal Total:</span> <span className="font-extrabold text-emerald-700">₹{msg.actionResult.dealTotalRupees.toFixed(2)}</span></div>
                      )}
                      {!msg.actionResult.dealTotalRupees && msg.actionResult.dealPriceRupees && (
                        <div><span className="font-semibold">Deal Price:</span> ₹{msg.actionResult.dealPriceRupees.toFixed(2)}</div>
                      )}
                      {msg.actionResult.expiresAt && (
                        <div className="text-amber-700 mt-1">
                          ⏱️ Expires: {new Date(msg.actionResult.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      )}
                      {/* Product price update */}
                      {msg.actionResult.newPriceRupees && (
                        <div><span className="font-semibold">New Price:</span> ₹{msg.actionResult.newPriceRupees.toFixed(2)}</div>
                      )}
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
                      {msg.proposal.currentReturnStatus && !msg.proposal.currentOrderStatus && (
                        <div><span className="font-bold text-gray-700">Current Return Status:</span> {msg.proposal.currentReturnStatus}</div>
                      )}
                      {msg.proposal.newReturnStatus && !msg.proposal.newOrderStatus && (
                        <div><span className="font-bold text-gray-700">Action:</span> <span className="font-bold text-emerald-800">{msg.proposal.newReturnStatus === 'return_approved' ? 'Approve / Accept Return' : msg.proposal.newReturnStatus === 'return_rejected' ? 'Reject / Decline Return' : msg.proposal.newReturnStatus}</span></div>
                      )}
                      {msg.proposal.refundAmountCents && (
                        <div><span className="font-bold text-gray-700">Refund Amount:</span> <span className="font-bold text-emerald-800">₹{(msg.proposal.refundAmountCents / 100).toFixed(2)}</span></div>
                      )}
                      {msg.proposal.scope === 'cart' ? (
                        <div><span className="font-bold text-gray-700">Scope:</span> <span className="font-bold text-indigo-700">Entire Abandoned Cart</span></div>
                      ) : (
                        msg.proposal.productName && <div><span className="font-bold text-gray-700">Product:</span> {msg.proposal.productName}</div>
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

              {/* Speaker icon button on the RIGHT SIDE of every Merchant Helper assistant message */}
              {msg.sender === 'assistant' && (
                <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                  <button
                    type="button"
                    onClick={() => handleToggleTTS(msg)}
                    disabled={loadingTtsMsgId === msg.id}
                    title={
                      playingMsgId === msg.id
                        ? 'Stop Audio Playback'
                        : loadingTtsMsgId === msg.id
                        ? 'Generating speech...'
                        : 'Listen to message (Text-to-Speech)'
                    }
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer border ${
                      playingMsgId === msg.id
                        ? 'bg-blue-50 border-blue-400 text-blue-600 animate-pulse shadow-xs'
                        : loadingTtsMsgId === msg.id
                        ? 'bg-amber-50 border-amber-300 text-amber-600 cursor-not-allowed'
                        : 'bg-white hover:bg-blue-50 border-gray-200 hover:border-blue-300 text-gray-500 hover:text-blue-600 shadow-xs'
                    }`}
                  >
                    {loadingTtsMsgId === msg.id ? (
                      <IconRefresh className="w-3.5 h-3.5 animate-spin text-amber-600" />
                    ) : playingMsgId === msg.id ? (
                      <span className="text-xs leading-none">🔊</span>
                    ) : (
                      <span className="text-xs leading-none">🔈</span>
                    )}
                  </button>
                  {ttsErrorMap[msg.id] && (
                    <span className="text-[9px] text-rose-500 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap">
                      {ttsErrorMap[msg.id]}
                    </span>
                  )}
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

      {/* Voice Error Banner */}
      {voiceError && (
        <div className="bg-amber-50 border-t border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between font-sans">
          <span>⚠️ {voiceError}</span>
          <button
            onClick={() => setVoiceError(null)}
            className="text-amber-600 hover:text-amber-900 font-bold ml-2 cursor-pointer"
          >
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Input Footer */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          {/* Microphone Voice Input Button */}
          <button
            type="button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={loading || isTranscribing}
            title={isRecording ? 'Click to stop recording' : isTranscribing ? 'Transcribing audio...' : 'Speak message (Speech-to-Text)'}
            className={`p-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer shrink-0 border ${
              isRecording
                ? 'bg-rose-50 border-rose-400 text-rose-600 animate-pulse ring-2 ring-rose-200'
                : isTranscribing
                ? 'bg-amber-50 border-amber-300 text-amber-600 cursor-not-allowed'
                : 'bg-gray-100 hover:bg-blue-50 border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-600'
            }`}
          >
            {isRecording ? (
              <span className="flex items-center gap-1.5 text-rose-700 font-extrabold px-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping inline-block" />
                <span>Stop</span>
              </span>
            ) : isTranscribing ? (
              <span className="flex items-center gap-1.5 text-amber-700 font-bold px-1">
                <IconRefresh className="w-3.5 h-3.5 animate-spin text-amber-600" />
                <span>Transcribing...</span>
              </span>
            ) : (
              <span className="text-base leading-none">🎙️</span>
            )}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording
                ? 'Listening... Speak your question or command naturally...'
                : isTranscribing
                ? 'Transcribing speech to text...'
                : "Ask questions or instruct actions (e.g. 'Mark order #1234 as dispatched', 'Initiate refund')..."
            }
            disabled={loading || isTranscribing}
            className="flex-1 bg-gray-50 border border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none rounded-xl px-4 py-2.5 text-xs text-gray-800 transition"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || loading || isTranscribing}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Send</span>
            <IconSend className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center font-bold text-lg">
                🗑️
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900 text-base">Clear this conversation?</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Your Merchant Helper chat history will be deleted.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer active:scale-95"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
