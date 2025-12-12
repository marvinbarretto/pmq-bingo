import { Injectable, signal } from '@angular/core';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

@Injectable({
  providedIn: 'root',
})
export class SpeechService {
  private recognition: SpeechRecognition | null = null;

  readonly isListening = signal(false);
  readonly isSupported = signal(false);
  readonly lastTranscript = signal('');

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): void {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.isSupported.set(!!SpeechRecognition);

    if (!SpeechRecognition) {
      console.warn('[Speech] Web Speech API not supported in this browser');
    }
  }

  start(): void {
    if (!this.isSupported()) {
      console.error('[Speech] Web Speech API not supported');
      return;
    }

    if (this.isListening()) {
      console.log('[Speech] Already listening');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure for continuous listening
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-GB'; // British English for PMQs

    this.recognition.onstart = () => {
      console.log('[Speech] Started listening...');
      this.isListening.set(true);
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          console.log(`[Speech] FINAL: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
          this.lastTranscript.set(transcript);
        } else {
          console.log(`[Speech] interim: "${transcript}"`);
        }
      }
    };

    this.recognition.onerror = (event) => {
      console.error('[Speech] Error:', event.error);
      if (event.error === 'not-allowed') {
        console.error('[Speech] Microphone access denied. Please allow microphone access.');
      }
    };

    this.recognition.onend = () => {
      console.log('[Speech] Stopped listening');
      this.isListening.set(false);

      // Auto-restart if we were supposed to be listening (handles browser auto-stop)
      // Commented out for now - manual restart preferred for testing
      // if (this.shouldBeListening) {
      //   this.recognition?.start();
      // }
    };

    try {
      this.recognition.start();
    } catch (e) {
      console.error('[Speech] Failed to start:', e);
    }
  }

  stop(): void {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
    }
    this.isListening.set(false);
  }

  toggle(): void {
    if (this.isListening()) {
      this.stop();
    } else {
      this.start();
    }
  }
}
