// ElevenLabs API integration for high-quality text-to-speech
// See API docs: https://docs.elevenlabs.io/api-reference/text-to-speech

// Voice types and preferences
export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  gender?: 'male' | 'female'; // Not directly from API, added for compatibility
  accent?: string; // Not directly from API, added for compatibility
}

interface VoicePreference {
  gender: 'male' | 'female';
  accent: string;
  voice_id?: string;
  variation: boolean;
  stability?: number;  // 0-1, higher is more stable but less expressive
  similarity_boost?: number; // 0-1, higher is more similar to original voice
  style?: number; // 0-1, how much style to apply
  use_speaker_boost?: boolean; // Improves quality of non-standard English text
}

// Audio playback related
interface AudioState {
  playing: boolean;
  audio: HTMLAudioElement | null;
}

class ElevenLabsService {
  private static API_URL = 'https://api.elevenlabs.io/v1';
  private apiKey: string;
  private voiceList: ElevenLabsVoice[] = [];
  private voicesLoaded: boolean = false;
  private voicePreference: VoicePreference = {
    gender: 'female',
    accent: 'Indian',
    variation: true,
    stability: 0.5,  // Default balanced setting
    similarity_boost: 0.75, // Slightly higher similarity
    style: 0.5, // Default style amount
    use_speaker_boost: true
  };
  private speakingCallbacks: ((speaking: boolean) => void)[] = [];
  private audioState: AudioState = {
    playing: false,
    audio: null
  };

  constructor() {
    // Access environment variables in Vite with import.meta.env
    // this.apiKey = import.meta.env.ELEVEN_LABS_API_KEY || '';
    this.apiKey ='sk_82f1bdce6783acdcc746d43715e762ed8183980dbc015af0';
    
    console.log('Eleven Labs service initialized. API key available:', !!this.apiKey);
    
    // Initialize
    this.loadVoices();
  }

  /**
   * Load available voices from Eleven Labs API
   */
  public async loadVoices(): Promise<ElevenLabsVoice[]> {
    if (this.voicesLoaded && this.voiceList.length > 0) {
      return this.voiceList;
    }

    try {
      const response = await fetch(`${ElevenLabsService.API_URL}/voices`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Process and enhance voice data with additional attributes
      this.voiceList = this.processVoiceList(data.voices || []);
      this.voicesLoaded = true;
      
      console.log(`Loaded ${this.voiceList.length} voices from Eleven Labs`);
      return this.voiceList;
    } catch (error) {
      console.error('Error loading Eleven Labs voices:', error);
      return [];
    }
  }

  /**
   * Process the raw voice list and add additional attributes
   */
  private processVoiceList(voices: any[]): ElevenLabsVoice[] {
    return voices.map(voice => {
      // Add additional attributes based on voice name or labels
      const name = voice.name.toLowerCase();
      const gender = this.inferGender(voice);
      const accent = this.inferAccent(voice);
      
      return {
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category,
        description: voice.description,
        preview_url: voice.preview_url,
        gender,
        accent
      };
    });
  }

  /**
   * Try to infer gender from voice metadata
   */
  private inferGender(voice: any): 'male' | 'female' {
    const name = voice.name.toLowerCase();
    const labels = voice.labels || {};
    
    // Check for explicit gender label
    if (labels.gender) {
      return labels.gender === 'male' ? 'male' : 'female';
    }
    
    // Infer from name
    if (name.includes('female') || 
        name.includes('woman') || 
        name.includes('girl') ||
        name.includes('actress')) {
      return 'female';
    }
    
    if (name.includes('male') || 
        name.includes('man') || 
        name.includes('boy') ||
        name.includes('actor')) {
      return 'male';
    }
    
    // Default based on commonly female/male names in the ElevenLabs lineup
    const femaleVoices = ['rachel', 'domi', 'bella', 'elli', 'anna', 'freya', 'grace', 'matilda'];
    const maleVoices = ['adam', 'antoni', 'josh', 'sam', 'thomas', 'charlie', 'harry', 'liam'];
    
    for (const fName of femaleVoices) {
      if (name.includes(fName)) return 'female';
    }
    
    for (const mName of maleVoices) {
      if (name.includes(mName)) return 'male';
    }
    
    // Default
    return 'female';
  }

  /**
   * Try to infer accent from voice metadata
   */
  private inferAccent(voice: any): string {
    const name = voice.name.toLowerCase();
    const labels = voice.labels || {};
    const description = (voice.description || '').toLowerCase();
    
    // Check for explicit accent label
    if (labels.accent) {
      return this.normalizeAccent(labels.accent);
    }
    
    // Check description for accent mentions
    const accentKeywords = {
      'Indian': ['indian', 'india'],
      'British': ['british', 'england', 'uk', 'london', 'english accent'],
      'American': ['american', 'us ', 'usa', 'united states'],
      'Australian': ['australian', 'australia', 'aussie'],
      'Irish': ['irish', 'ireland'],
      'Scottish': ['scottish', 'scotland'],
      'South African': ['south africa', 'south african'],
      'Nigerian': ['nigerian', 'nigeria']
    };
    
    for (const [accent, keywords] of Object.entries(accentKeywords)) {
      for (const keyword of keywords) {
        if (description.includes(keyword) || name.includes(keyword)) {
          return accent;
        }
      }
    }
    
    // Default
    return 'American';
  }

  /**
   * Normalize accent naming
   */
  private normalizeAccent(accent: string): string {
    const accentMap: {[key: string]: string} = {
      'us': 'American',
      'usa': 'American',
      'american': 'American',
      'united states': 'American',
      'uk': 'British',
      'british': 'British',
      'england': 'British',
      'india': 'Indian',
      'indian': 'Indian',
      'australia': 'Australian',
      'australian': 'Australian',
      'ireland': 'Irish',
      'irish': 'Irish'
    };
    
    const normalized = accentMap[accent.toLowerCase()];
    return normalized || accent;
  }

  /**
   * Set voice preference
   */
  public setVoicePreference(preference: Partial<VoicePreference>): void {
    this.voicePreference = { ...this.voicePreference, ...preference };
    console.log('Eleven Labs voice preference set:', this.voicePreference);
  }

  /**
   * Get current voice preference
   */
  public getVoicePreference(): VoicePreference {
    return { ...this.voicePreference };
  }

  /**
   * Find the best matching voice based on preferences
   */
  private async findBestMatchingVoice(): Promise<string> {
    // Always use the specified voice ID as requested
    return "ftDdhfYtmfGP0tFlBYA1";
  }

  /**
   * Convert text to speech using Eleven Labs API
   */
  public async speak(text: string, voiceId?: string): Promise<void> {
    try {
      // Stop any current audio
      this.stop();
      
      // Determine which voice to use
      const voice_id = voiceId || await this.findBestMatchingVoice();
      
      // Configure TTS settings
      const { stability, similarity_boost, style, use_speaker_boost } = this.voicePreference;
      
      // Apply voice variations if enabled
      let modifiedStability = stability;
      let modifiedSimilarity = similarity_boost;
      
      if (this.voicePreference.variation) {
        // Create subtle variations in voice parameters for more natural speech
        const variationAmount = 0.05; // Small variation for subtlety
        modifiedStability = this.applyVariation(stability || 0.5, variationAmount);
        modifiedSimilarity = this.applyVariation(similarity_boost || 0.75, variationAmount);
      }
      
      // Build the request
      const response = await fetch(`${ElevenLabsService.API_URL}/text-to-speech/${voice_id}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2', // Latest multilingual model
          voice_settings: {
            stability: modifiedStability,
            similarity_boost: modifiedSimilarity,
            style: style || 0.5,
            use_speaker_boost: use_speaker_boost !== false
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Eleven Labs API error: ${response.status} ${response.statusText}`);
      }
      
      // Get audio as blob
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play the audio
      this.playAudio(audioUrl);
      
    } catch (error) {
      console.error('Eleven Labs TTS error:', error);
      // Fallback to browser TTS if Eleven Labs fails
      this.fallbackToSpeechSynthesis(text);
    }
  }

  /**
   * Add controlled variation to a parameter value
   */
  private applyVariation(value: number, amount: number): number {
    const variation = (Math.random() * amount * 2) - amount;
    return Math.max(0, Math.min(1, value + variation));
  }

  /**
   * Fallback to browser's SpeechSynthesis if Eleven Labs fails
   * Note: Currently disabled to prevent double-speech issues
   */
  private fallbackToSpeechSynthesis(text: string): void {
    // Disabled fallback to browser speech synthesis to prevent double-speaking
    console.log('ElevenLabs API failed, but fallback to browser speech is disabled to prevent double-speaking');
    
    // Still notify that we're not speaking so UI updates correctly
    this.notifySpeakingChange(false);
    
    /* Original fallback code preserved for reference:
    try {
      if (!window.speechSynthesis) return;
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find an Indian female voice if that's our preference
      if (this.voicePreference.gender === 'female' && this.voicePreference.accent === 'Indian') {
        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find(v => 
          v.lang === 'hi-IN' || 
          v.lang === 'en-IN' || 
          v.name.includes('Indian') || 
          v.name.includes('Heera')
        );
        
        if (indianVoice) {
          utterance.voice = indianVoice;
        }
      }
      
      // Set speaking callbacks
      utterance.onstart = () => this.notifySpeakingChange(true);
      utterance.onend = () => this.notifySpeakingChange(false);
      utterance.onerror = () => this.notifySpeakingChange(false);
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Fallback speech synthesis failed:', error);
    }
    */
  }

  /**
   * Play audio and manage audio state
   */
  private playAudio(audioUrl: string): void {
    // Create audio element
    const audio = new Audio(audioUrl);
    
    // Set up event handlers
    audio.onplay = () => this.notifySpeakingChange(true);
    audio.onpause = () => this.notifySpeakingChange(false);
    audio.onended = () => {
      this.notifySpeakingChange(false);
      // Clean up URL object
      URL.revokeObjectURL(audioUrl);
    };
    audio.onerror = () => {
      console.error('Audio playback error');
      this.notifySpeakingChange(false);
      URL.revokeObjectURL(audioUrl);
    };
    
    // Store audio reference
    this.audioState.audio = audio;
    
    // Play the audio
    audio.play().catch(error => {
      console.error('Error playing audio:', error);
      this.notifySpeakingChange(false);
    });
  }

  /**
   * Stop current speaking
   */
  public stop(): void {
    if (this.audioState.audio) {
      this.audioState.audio.pause();
      this.audioState.audio = null;
    }
    
    // Also stop speech synthesis if it was used as fallback
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    
    this.notifySpeakingChange(false);
  }

  /**
   * Check if audio is currently playing
   */
  public isSpeaking(): boolean {
    return this.audioState.playing;
  }

  /**
   * Notify callbacks of speaking state changes
   */
  private notifySpeakingChange(speaking: boolean): void {
    this.audioState.playing = speaking;
    for (const callback of this.speakingCallbacks) {
      callback(speaking);
    }
  }

  /**
   * Register a callback for speaking state changes
   */
  public onSpeakingChange(callback: (speaking: boolean) => void): void {
    this.speakingCallbacks.push(callback);
    // Immediately call with current state
    callback(this.audioState.playing);
  }

  /**
   * Remove a speaking callback
   */
  public removeSpeakingCallback(callback: (speaking: boolean) => void): void {
    this.speakingCallbacks = this.speakingCallbacks.filter(cb => cb !== callback);
  }

  /**
   * Toggle speech - stop if speaking, start if not
   */
  public async toggleSpeech(text: string): Promise<void> {
    if (this.audioState.playing) {
      this.stop();
      return Promise.resolve();
    } else {
      return this.speak(text);
    }
  }

  /**
   * Get available voices
   */
  public async getVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.voicesLoaded) {
      await this.loadVoices();
    }
    return [...this.voiceList];
  }
}

// Create a singleton instance
const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;