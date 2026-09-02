import { env } from '../config/env.js';

export interface TranscribeAudioParams {
  audioBase64: string;
  mimeType?: string;
  filename?: string;
}

const COMMON_BUSINESS_PROMPT = 'cart, carts, abandoned cart, order, orders, return, refund, payment, failed payment, product, discount, deal, customer, delivered, dispatched, cancelled, confirm, minutes, hours, days, ₹';

export class TranscriptionService {
  /**
   * Transcribe recorded audio buffer/base64 using Groq Whisper Large V3.
   * Auto-detects spoken language (English, Hindi, Hinglish).
   * Validates script output to prevent Urdu/Arabic script responses for Hindi audio.
   */
  async transcribeAudio(params: TranscribeAudioParams): Promise<string> {
    const apiKey = process.env.GROQ_API_KEY || env.GROQ_API_KEY;

    // Fallback mode for unit tests or unconfigured Groq API key
    if (!apiKey || apiKey === 'placeholder-groq-key' || (process.env.NODE_ENV === 'test' && process.env.TEST_LIVE_WHISPER !== 'true')) {
      return this.getMockTranscription(params);
    }

    let cleanBase64 = params.audioBase64.trim();
    let detectedMime = params.mimeType || 'audio/webm';

    // Handle Data URI format: data:audio/webm;base64,GkXf...
    if (cleanBase64.startsWith('data:')) {
      const match = cleanBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        detectedMime = match[1];
        cleanBase64 = match[2];
      }
    }

    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    if (audioBuffer.length === 0) {
      throw new Error('Audio recording is empty');
    }

    const ext = detectedMime.includes('mp4') ? 'm4a' : detectedMime.includes('wav') ? 'wav' : detectedMime.includes('ogg') ? 'ogg' : 'webm';
    const filename = params.filename || `speech_${Date.now()}.${ext}`;

    // Initial transcription call (Auto-language detection with business domain prompt)
    let transcript = await this.callGroqWhisper(apiKey, audioBuffer, detectedMime, filename);

    // Script validation: If output contains Urdu/Arabic script characters, perform targeted Hindi retry
    if (this.containsUrduArabicScript(transcript)) {
      console.log('[TranscriptionService] Urdu/Arabic script detected in transcript. Retrying with explicit Hindi language setting.');
      const hindiRetryTranscript = await this.callGroqWhisper(apiKey, audioBuffer, detectedMime, filename, 'hi');
      if (hindiRetryTranscript && !this.containsUrduArabicScript(hindiRetryTranscript)) {
        transcript = hindiRetryTranscript;
      }
    }

    if (!transcript) {
      throw new Error('No speech detected in the audio recording');
    }

    return transcript;
  }

  /**
   * Detects presence of Urdu/Arabic script characters (Unicode block range 0600-06FF / 0750-077F / 08A0-08FF / FB50-FDFF / FE70-FEFF).
   */
  public containsUrduArabicScript(text: string): boolean {
    if (!text) return false;
    return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
  }

  private async callGroqWhisper(
    apiKey: string,
    audioBuffer: Buffer,
    mimeType: string,
    filename: string,
    forcedLanguage?: string
  ): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('model', 'whisper-large-v3');
    formData.append('prompt', COMMON_BUSINESS_PROMPT);

    if (forcedLanguage) {
      formData.append('language', forcedLanguage);
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[TranscriptionService] Groq Whisper API error:', response.status, errText);
      throw new Error(`Groq Whisper transcription failed (${response.status})`);
    }

    const data: any = await response.json();
    return (data.text || '').trim();
  }

  private getMockTranscription(params: TranscribeAudioParams): string {
    // Return mock transcription for tests
    return 'cart 2 ko 80 percent discount de do aur 5 minute ke liye rakho';
  }
}

export const transcriptionService = new TranscriptionService();
