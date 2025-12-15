/**
 * Speech Recognition service for voice dictation
 * Uses the Web Speech API for browser-based speech recognition
 */

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (result: SpeechRecognitionResult) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

// Check if Speech Recognition is supported
export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

// Available languages for speech recognition
export const speechLanguages = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
  { code: 'es-ES', name: 'Español (España)', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Español (México)', flag: '🇲🇽' },
  { code: 'fr-FR', name: 'Français', flag: '🇫🇷' },
  { code: 'de-DE', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Português (Brasil)', flag: '🇧🇷' },
  { code: 'pt-PT', name: 'Português (Portugal)', flag: '🇵🇹' },
  { code: 'zh-CN', name: '中文 (简体)', flag: '🇨🇳' },
  { code: 'zh-TW', name: '中文 (繁體)', flag: '🇹🇼' },
  { code: 'ja-JP', name: '日本語', flag: '🇯🇵' },
  { code: 'ko-KR', name: '한국어', flag: '🇰🇷' },
  { code: 'ru-RU', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar-SA', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi-IN', name: 'हिन्दी', flag: '🇮🇳' },
];

const SPEECH_SETTINGS_KEY = 'viny-speech-settings';

interface SpeechSettings {
  language: string;
  autoCapitalize: boolean;
  autoPunctuation: boolean;
}

function loadSettings(): SpeechSettings {
  try {
    const stored = localStorage.getItem(SPEECH_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {
      language: 'en-US',
      autoCapitalize: true,
      autoPunctuation: true,
    };
  } catch {
    return {
      language: 'en-US',
      autoCapitalize: true,
      autoPunctuation: true,
    };
  }
}

function saveSettings(settings: SpeechSettings): void {
  localStorage.setItem(SPEECH_SETTINGS_KEY, JSON.stringify(settings));
}

export function getSpeechSettings(): SpeechSettings {
  return loadSettings();
}

export function setSpeechLanguage(language: string): void {
  const settings = loadSettings();
  settings.language = language;
  saveSettings(settings);
}

export function setSpeechAutoCapitalize(enabled: boolean): void {
  const settings = loadSettings();
  settings.autoCapitalize = enabled;
  saveSettings(settings);
}

export function setSpeechAutoPunctuation(enabled: boolean): void {
  const settings = loadSettings();
  settings.autoPunctuation = enabled;
  saveSettings(settings);
}

class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private options: SpeechRecognitionOptions = {};

  constructor() {
    if (isSpeechRecognitionSupported()) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.setupRecognition();
    }
  }

  private setupRecognition(): void {
    if (!this.recognition) return;

    const settings = loadSettings();

    this.recognition.lang = settings.language;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.options.onStart?.();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.options.onEnd?.();
    };

    this.recognition.onerror = (event) => {
      let errorMessage = 'Speech recognition error';

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your audio settings.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition aborted.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }

      this.options.onError?.(errorMessage);
    };

    this.recognition.onresult = (event) => {
      const settings = loadSettings();

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        let transcript = result[0].transcript;

        // Apply auto-capitalization
        if (settings.autoCapitalize && result.isFinal) {
          transcript = this.capitalizeTranscript(transcript);
        }

        // Apply auto-punctuation hints
        if (settings.autoPunctuation && result.isFinal) {
          transcript = this.addPunctuationHints(transcript);
        }

        this.options.onResult?.({
          transcript,
          confidence: result[0].confidence,
          isFinal: result.isFinal,
        });
      }
    };
  }

  private capitalizeTranscript(text: string): string {
    // Capitalize first letter
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    // Capitalize after sentence endings
    text = text.replace(/([.!?]\s+)([a-z])/g, (_, punctuation, letter) => {
      return punctuation + letter.toUpperCase();
    });

    return text;
  }

  private addPunctuationHints(text: string): string {
    // Common voice punctuation commands
    const punctuationMap: Record<string, string> = {
      ' period': '.',
      ' full stop': '.',
      ' comma': ',',
      ' question mark': '?',
      ' exclamation mark': '!',
      ' exclamation point': '!',
      ' colon': ':',
      ' semicolon': ';',
      ' dash': ' - ',
      ' hyphen': '-',
      ' open quote': '"',
      ' close quote': '"',
      ' open parenthesis': '(',
      ' close parenthesis': ')',
      ' new line': '\n',
      ' new paragraph': '\n\n',
    };

    let result = text.toLowerCase();
    for (const [command, punctuation] of Object.entries(punctuationMap)) {
      result = result.replace(new RegExp(command, 'gi'), punctuation);
    }

    return result;
  }

  start(options: SpeechRecognitionOptions = {}): boolean {
    if (!this.recognition) {
      options.onError?.('Speech recognition is not supported in this browser.');
      return false;
    }

    if (this.isListening) {
      return true;
    }

    this.options = options;

    // Update settings
    const settings = loadSettings();
    this.recognition.lang = options.language || settings.language;
    this.recognition.continuous = options.continuous ?? true;
    this.recognition.interimResults = options.interimResults ?? true;

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      options.onError?.('Failed to start speech recognition.');
      return false;
    }
  }

  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  abort(): void {
    if (this.recognition) {
      this.recognition.abort();
    }
  }

  isActive(): boolean {
    return this.isListening;
  }

  updateLanguage(language: string): void {
    setSpeechLanguage(language);
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }
}

// Singleton instance
export const speechRecognition = new SpeechRecognitionService();

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
