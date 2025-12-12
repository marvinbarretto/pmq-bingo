import { Injectable, signal } from '@angular/core';
import { createModel, KaldiRecognizer, Model } from 'vosk-browser';

// Small English model (~50MB) - good balance of size/accuracy
const MODEL_URL = 'https://ccoreilly.github.io/vosk-browser/models/vosk-model-small-en-us-0.15.tar.gz';

export type AudioSource = 'mic' | 'tab';

export interface PhraseMatch {
  phrase: string;
  transcript: string;
}

@Injectable({
  providedIn: 'root',
})
export class SpeechService {
  private model: Model | null = null;
  private recognizer: KaldiRecognizer | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private phrasesToMatch: string[] = [];
  private lastPartial = '';

  readonly isListening = signal(false);
  readonly isSupported = signal(true); // Vosk works everywhere with WASM
  readonly isModelLoading = signal(false);
  readonly modelLoaded = signal(false);
  readonly lastTranscript = signal('');
  readonly currentWord = signal(''); // Latest word heard
  readonly audioSource = signal<AudioSource>('tab');

  // Callback for when a phrase is matched
  onPhraseMatch: ((match: PhraseMatch) => void) | null = null;

  async loadModel(): Promise<void> {
    if (this.model || this.isModelLoading()) return;

    this.isModelLoading.set(true);
    console.log('[Speech] Loading Vosk model... (this may take a minute on first load)');

    try {
      this.model = await createModel(MODEL_URL);
      this.modelLoaded.set(true);
      console.log('[Speech] Model loaded successfully!');
    } catch (error) {
      console.error('[Speech] Failed to load model:', error);
      throw error;
    } finally {
      this.isModelLoading.set(false);
    }
  }

  async start(): Promise<void> {
    if (this.isListening()) {
      console.log('[Speech] Already listening');
      return;
    }

    // Load model if not already loaded
    if (!this.model) {
      await this.loadModel();
    }

    if (!this.model) {
      console.error('[Speech] Model not available');
      return;
    }

    try {
      const source = this.audioSource();

      if (source === 'tab') {
        // Capture tab/screen audio
        console.log('[Speech] Requesting tab audio capture...');
        console.log('[Speech] Select the tab playing PMQ video and check "Share tab audio"');
        this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: true, // Required, but we only use audio
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });

        // Check if we got audio
        const audioTracks = this.mediaStream.getAudioTracks();
        if (audioTracks.length === 0) {
          console.error('[Speech] No audio track! Make sure to check "Share tab audio" in the dialog');
          this.stop();
          return;
        }
        console.log('[Speech] Got audio track:', audioTracks[0].label);
      } else {
        // Microphone capture
        console.log('[Speech] Requesting microphone access...');
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1,
            sampleRate: 16000,
          },
          video: false,
        });
      }

      // Create audio context - let browser pick sample rate, we'll resample
      this.audioContext = new AudioContext();
      const actualSampleRate = this.audioContext.sampleRate;
      console.log(`[Speech] AudioContext sample rate: ${actualSampleRate}Hz`);

      // Create recognizer at 16kHz (what Vosk expects)
      this.recognizer = new this.model.KaldiRecognizer(16000);

      // Set up result handlers
      this.recognizer.on('result', (message: unknown) => {
        const msg = message as { result?: { text?: string } };
        const text = msg.result?.text;
        if (text) {
          this.lastTranscript.set(text);
          this.checkForPhraseMatches(text);
        }
      });

      this.recognizer.on('partialresult', (message: unknown) => {
        const msg = message as { result?: { partial?: string } };
        const partial = msg.result?.partial;
        if (partial && partial !== this.lastPartial) {
          // Extract just the new word(s)
          const newContent = partial.slice(this.lastPartial.length).trim();
          if (newContent) {
            const words = newContent.split(' ');
            const lastWord = words[words.length - 1];
            if (lastWord) {
              this.currentWord.set(lastWord);
            }
          }
          this.lastPartial = partial;
          // Also check partials for matches
          this.checkForPhraseMatches(partial);
        }
      });

      // Connect audio source to recognizer
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      let audioChunks = 0;

      this.processor.onaudioprocess = (event) => {
        if (this.recognizer) {
          audioChunks++;
          if (audioChunks % 50 === 0) {
            console.log(`[Speech] Processing audio... (${audioChunks} chunks)`);
          }
          this.recognizer.acceptWaveform(event.inputBuffer);
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      this.isListening.set(true);
      console.log('[Speech] Started listening! Audio is being processed...');

    } catch (error) {
      console.error('[Speech] Failed to start:', error);
      this.stop();
      throw error;
    }
  }

  stop(): void {
    console.log('[Speech] Stopping...');

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.recognizer) {
      this.recognizer.remove();
      this.recognizer = null;
    }

    this.lastPartial = '';
    this.currentWord.set('');
    this.isListening.set(false);
    console.log('[Speech] Stopped listening');
  }

  async toggle(): Promise<void> {
    if (this.isListening()) {
      this.stop();
    } else {
      await this.start();
    }
  }

  setPhrases(phrases: string[]): void {
    // Normalize phrases for matching (lowercase, trimmed)
    this.phrasesToMatch = phrases.map(p => p.toLowerCase().trim());
  }

  private checkForPhraseMatches(transcript: string): void {
    if (!this.onPhraseMatch || this.phrasesToMatch.length === 0) return;

    const normalizedTranscript = transcript.toLowerCase();

    for (const phrase of this.phrasesToMatch) {
      // Check if the phrase appears in the transcript
      if (this.fuzzyMatch(normalizedTranscript, phrase)) {
        console.log(`%c[Speech] MATCH: "${phrase}" found in "${transcript}"`, 'color: orange; font-weight: bold');
        this.onPhraseMatch({ phrase, transcript });
        // Remove from list so we don't match again
        this.phrasesToMatch = this.phrasesToMatch.filter(p => p !== phrase);
      }
    }
  }

  private fuzzyMatch(transcript: string, phrase: string): boolean {
    // Direct substring match
    if (transcript.includes(phrase)) {
      return true;
    }

    // Word-by-word match for multi-word phrases
    const phraseWords = phrase.split(/\s+/);
    const transcriptWords = transcript.split(/\s+/);

    if (phraseWords.length === 1) {
      // Single word - check if any transcript word matches
      return transcriptWords.some(tw => tw === phrase || this.similarWords(tw, phrase));
    }

    // Multi-word phrase - check if words appear in sequence
    for (let i = 0; i <= transcriptWords.length - phraseWords.length; i++) {
      let matches = true;
      for (let j = 0; j < phraseWords.length; j++) {
        if (!this.similarWords(transcriptWords[i + j], phraseWords[j])) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }

    return false;
  }

  private similarWords(word1: string, word2: string): boolean {
    if (word1 === word2) return true;

    // Allow for minor differences (Levenshtein distance of 1-2 for longer words)
    if (word1.length > 4 && word2.length > 4) {
      const distance = this.levenshteinDistance(word1, word2);
      return distance <= 2;
    }

    return false;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }
}
