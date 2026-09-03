import { useState, useRef, useEffect } from 'react';
import { getApiUrl } from '../../config/api';
import { authService } from '../../services/authService';
import { IconRefresh, IconCheck, IconClose, IconSpeaker, IconMic } from '../common/Icons';
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
    products?: string[];
    productName?: string;
    originalTotalRupees?: number;
    dealTotalRupees?: number;
    cartId?: string;
    customerEmail?: string;
    customerName?: string;
    expiresAt?: string;
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
  text: 'Hi! I\'m your RazorShop Merchant Assistant. Ask me about your orders, revenue, inventory, or recovery cases — by text or voice.',
  timestamp: new Date(),
};

const suggestedQuestions = [
  'Revenue this week',
  'Pending orders',
  'Low stock alerts',
  'Recovery cases',
];

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
      // Fallback
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

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedAudioMap = useRef<Map<string, { audio: string; mimeType: string }>>(new Map());

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const isInitialMount = useRef(true);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore
    }
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClearChat = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingMsgId(null);
    setMessages([DEFAULT_WELCOME_MSG]);
    setPendingProposal(null);
    setShowClearConfirm(false);
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleToggleTTS = async (msg: ChatMessage) => {
    if (playingMsgId === msg.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingMsgId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingMsgId(null);
    }

    const cached = cachedAudioMap.current.get(msg.id);
    if (cached) {
      playAudioData(msg.id, cached.audio, cached.mimeType);
      return;
    }

    try {
      setLoadingTtsMsgId(msg.id);

      const res = await fetch(getApiUrl('/merchant/helper/tts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({ text: msg.text }),
      });

      if (!res.ok) {
        throw new Error('TTS unavailable');
      }

      const data = await res.json();
      if (!data.audio) throw new Error('No audio returned');

      cachedAudioMap.current.set(msg.id, { audio: data.audio, mimeType: data.mimeType || 'audio/mp3' });
      playAudioData(msg.id, data.audio, data.mimeType || 'audio/mp3');
    } catch (err: any) {
      setError(err.message || 'TTS Error');
    } finally {
      setLoadingTtsMsgId(null);
    }
  };

  const playAudioData = (msgId: string, base64Audio: string, mimeType: string) => {
    try {
      const audioUrl = `data:${mimeType};base64,${base64Audio}`;
      const newAudio = new Audio(audioUrl);

      newAudio.onended = () => {
        setPlayingMsgId(null);
        audioRef.current = null;
      };

      newAudio.onerror = () => {
        setPlayingMsgId(null);
        audioRef.current = null;
      };

      audioRef.current = newAudio;
      setPlayingMsgId(msgId);
      newAudio.play().catch(() => {
        setPlayingMsgId(null);
        audioRef.current = null;
      });
    } catch {
      setPlayingMsgId(null);
      audioRef.current = null;
    }
  };

  const handleStartRecording = async () => {
    setVoiceError(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        await handleSendAudioToStt(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      setVoiceError('Microphone permission denied or unsupported');
      setIsRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendAudioToStt = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      setVoiceError(null);

      // Convert blob to base64 for the /helper/transcribe endpoint (expects JSON, not FormData)
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data-URI prefix (data:<mime>;base64,) — send only the raw base64 payload
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read audio data'));
        reader.readAsDataURL(audioBlob);
      });

      const response = await fetch(getApiUrl('/merchant/helper/transcribe'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeader(),
        },
        body: JSON.stringify({
          audio: audioBase64,
          mimeType: audioBlob.type || 'audio/webm',
          filename: 'speech.webm',
        }),
      });

      if (!response.ok) {
        throw new Error('Speech recognition failed');
      }

      const data = await response.json();
      if (data.text && data.text.trim()) {
        await handleSendMessage(data.text.trim());
      } else {
        setVoiceError('No speech detected. Please speak clearly and try again.');
      }
    } catch (err: any) {
      setVoiceError(err.message || 'Failed to process speech input');
    } finally {
      setIsTranscribing(false);
    }
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

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest block font-display" style={{ color: 'var(--c-gold)' }}>
            AI POWERED
          </span>
          <h2 className="text-3xl font-extrabold font-display tracking-tight mt-0.5" style={{ color: 'var(--c-text)' }}>
            Merchant Helper.
          </h2>
          <p className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>
            Your store assistant — ask by text or voice.
          </p>
        </div>

        <button
          onClick={() => setShowClearConfirm(true)}
          className="px-3.5 py-1.5 rounded-full border text-xs font-bold font-display cursor-pointer transition"
          style={{ background: 'var(--c-surface2)', borderColor: 'var(--c-border)', color: 'var(--c-muted)' }}
        >
          Clear Chat
        </button>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-display">
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q)}
            disabled={loading}
            className="px-4 py-1.5 rounded-full font-bold transition cursor-pointer disabled:opacity-50"
            style={{
              background: 'var(--c-surface2)',
              color: 'var(--c-muted)',
              border: '1px solid var(--c-border-soft)',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Messages Feed Container */}
      <div className="space-y-6 my-6 min-h-[350px] max-h-[620px] overflow-y-auto pr-2 font-sans">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-start gap-3 max-w-3xl">
              {msg.sender === 'assistant' && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-display mt-0.5"
                  style={{ background: 'var(--c-gold-dim)', color: 'var(--c-gold)', border: '1px solid var(--c-gold)' }}
                >
                  AI
                </div>
              )}

              <div
                className="rounded-2xl p-4 text-xs leading-relaxed transition"
                style={{
                  background: msg.sender === 'user' ? 'var(--c-gold)' : 'var(--c-surface2)',
                  color: msg.sender === 'user' ? '#0a0908' : 'var(--c-text)',
                  border: msg.sender === 'user' ? 'none' : '1px solid var(--c-border-soft)',
                }}
              >
                {msg.sender === 'user' ? (
                  <p className="font-semibold" style={{ color: '#0a0908' }}>{msg.text}</p>
                ) : (
                  <FormattedMarkdownText content={msg.text} />
                )}

                {/* Action Executed Result */}
                {msg.actionExecuted && msg.actionResult && (
                  <div className="mt-3 p-3 rounded-xl text-xs space-y-1" style={{ background: 'var(--c-status-green-bg)', color: 'var(--c-status-green-text)', border: '1px solid var(--c-border-soft)' }}>
                    <div className="flex items-center gap-1.5 font-bold font-display">
                      <IconCheck className="w-4 h-4" />
                      <span>Action Executed</span>
                    </div>
                  </div>
                )}

                {/* Proposal Confirmation Box */}
                {msg.proposal && (
                  <div className="mt-4 p-4 rounded-xl text-xs space-y-3 font-sans" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-gold)' }}>
                    <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--c-border-soft)' }}>
                      <span className="font-bold font-display" style={{ color: 'var(--c-gold)' }}>Action Pending Confirmation</span>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => handleConfirmProposal(msg.proposal!)}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg font-bold text-xs transition cursor-pointer font-display"
                        style={{ background: 'var(--c-gold)', color: '#0a0908' }}
                      >
                        Confirm Action
                      </button>
                      <button
                        onClick={handleCancelProposal}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg font-bold text-xs transition cursor-pointer font-display"
                        style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timestamp & Speaker Icon */}
            <div className="flex items-center gap-2 mt-1.5 text-[11px] pl-11" style={{ color: 'var(--c-text-dim)' }}>
              <span>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>

              {msg.sender === 'assistant' && (
                <button
                  type="button"
                  onClick={() => handleToggleTTS(msg)}
                  disabled={loadingTtsMsgId === msg.id}
                  className="p-1 rounded transition cursor-pointer flex items-center justify-center"
                  style={{ color: playingMsgId === msg.id ? 'var(--c-gold)' : 'var(--c-muted)' }}
                  title="Listen to message"
                >
                  {loadingTtsMsgId === msg.id ? (
                    <IconRefresh className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <IconSpeaker className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs py-2 font-display" style={{ color: 'var(--c-text-dim)' }}>
            <IconRefresh className="w-4 h-4 animate-spin" style={{ color: 'var(--c-gold)' }} />
            <span>Merchant Helper is processing live store query...</span>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Chat Error Banner */}
      {error && (
        <div className="p-3 rounded-xl text-xs flex items-center justify-between font-sans" style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="font-bold cursor-pointer">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Voice Error Banner */}
      {voiceError && (
        <div className="p-3 rounded-xl text-xs flex items-center justify-between font-sans" style={{ background: 'var(--c-status-amber-bg)', color: 'var(--c-status-amber-text)' }}>
          <span>⚠️ {voiceError}</span>
          <button onClick={() => setVoiceError(null)} className="font-bold cursor-pointer">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Sticky Bottom Input Bar */}
      <div
        className="rounded-[24px] border p-2.5 themed font-sans shadow-xs"
        style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)' }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording
                ? 'Listening... Speak naturally...'
                : isTranscribing
                ? 'Transcribing speech...'
                : 'Ask about your store...'
            }
            disabled={loading || isTranscribing}
            className="flex-1 bg-transparent px-4 py-2 text-xs focus:outline-none font-medium placeholder:text-[var(--c-muted)]"
            style={{ color: 'var(--c-text)' }}
          />

          <button
            type="button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            disabled={loading || isTranscribing}
            className="p-2.5 rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center"
            style={{ background: 'var(--c-surface2)', color: isRecording ? 'var(--c-status-red-text)' : 'var(--c-text-dim)' }}
            title="Speech input"
          >
            <IconMic className="w-4 h-4" />
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() || loading || isTranscribing}
            className="p-2.5 rounded-xl text-xs font-bold transition cursor-pointer font-display shrink-0 flex items-center justify-center disabled:opacity-40"
            style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
          >
            <span className="text-sm leading-none">➜</span>
          </button>
        </form>
      </div>

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="rounded-2xl p-6 max-w-sm w-full space-y-4 border themed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', color: 'var(--c-text)' }}>
            <div>
              <h3 className="font-bold text-base font-display">Clear chat history?</h3>
              <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
                Your Merchant Helper chat history will be reset.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer font-display"
                style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer font-display"
                style={{ background: 'var(--c-status-red-bg)', color: 'var(--c-status-red-text)' }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
