import { env } from '../config/env.js';

export interface GenerateSpeechParams {
  text: string;
}

export interface GenerateSpeechResult {
  audio: string;
  mimeType: string;
}

export class TTSService {
  /**
   * Generates text-to-speech audio using Sarvam AI Bulbul v3 model (speaker: shubh).
   */
  async generateSpeech(params: GenerateSpeechParams): Promise<GenerateSpeechResult> {
    const apiKey = process.env.SARVAM_API_KEY || env.SARVAM_API_KEY;

    // Fallback mode for unit tests or unconfigured Sarvam API key
    if (!apiKey || apiKey === 'placeholder-sarvam-key' || (process.env.NODE_ENV === 'test' && process.env.TEST_LIVE_SARVAM !== 'true')) {
      return this.getMockAudioResult(params);
    }

    const cleanText = this.cleanTextForSpeech(params.text);
    if (!cleanText) {
      throw new Error('Text content is empty after cleaning for speech');
    }

    const targetLanguageCode = this.detectTargetLanguageCode(cleanText);

    const response = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        inputs: [cleanText],
        target_language_code: targetLanguageCode,
        speaker: 'shubh',
        model: 'bulbul:v3',
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[TTSService] Sarvam TTS API error:', response.status, errText);
      throw new Error(`Sarvam TTS generation failed (${response.status})`);
    }

    const data: any = await response.json();
    const audioBase64 = data.audios && data.audios[0] ? data.audios[0] : null;

    if (!audioBase64) {
      throw new Error('No audio payload returned from Sarvam TTS service');
    }

    return {
      audio: audioBase64,
      mimeType: 'audio/wav',
    };
  }

  /**
   * Cleans visual Markdown tags for speech synthesis without changing words or amounts.
   */
  public cleanTextForSpeech(text: string): string {
    if (!text) return '';
    let cleaned = text;

    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    cleaned = cleaned.replace(/\|/g, ' ');
    cleaned = cleaned.replace(/-{3,}/g, '');
    cleaned = cleaned.replace(/^[ \t]*[•\-\*][ \t]*/gm, '');
    cleaned = cleaned.replace(/₹\s*/g, 'rupees ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Determines Sarvam target_language_code ("hi-IN" for Hindi & Hinglish, "en-IN" for English).
   * Never selects Urdu under any circumstances.
   */
  public detectTargetLanguageCode(text: string): 'hi-IN' | 'en-IN' {
    if (!text) return 'hi-IN';

    // If text contains Devanagari script (Hindi)
    if (/[\u0900-\u097F]/.test(text)) {
      return 'hi-IN';
    }

    // Check if text has Hinglish keywords
    const lower = text.toLowerCase();
    const hinglishKeywords = [
      'aapke', 'apne', 'hai', 'hain', 'ka', 'ke', 'ki', 'ko', 'me', 'mein', 'par', 'se',
      'de', 'do', 'mili', 'mila', 'karna', 'karto', 'chahte', 'kardo', 'mat', 'aur', 'radd',
      'filhal', 'kuch', 'huye', 'hue', 'wala', 'wali', 'wale', 'bhi', 'humne'
    ];

    const words = lower.split(/\W+/);
    const isHinglish = words.some((w) => hinglishKeywords.includes(w));
    if (isHinglish) {
      return 'hi-IN';
    }

    return 'en-IN';
  }

  private getMockAudioResult(params: GenerateSpeechParams): GenerateSpeechResult {
    // Standard silent 1-second mock WAV base64 string for testing
    const mockWavBase64 = 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    return {
      audio: mockWavBase64,
      mimeType: 'audio/wav',
    };
  }
}

export const ttsService = new TTSService();
