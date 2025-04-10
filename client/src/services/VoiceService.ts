// Voice service to handle speech-to-text and text-to-speech operations

// Define voice preferences interface
interface VoicePreference {
  gender: "male" | "female";
  accent: string;
  voiceIndex?: number;
  variation: boolean; // Flag to enable speech variation to avoid repetitive patterns
}

class VoiceService {
  private speechSynthesis: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private speaking: boolean = false;
  private speakingCallbacks: ((speaking: boolean) => void)[] = [];
  private voicePreference: VoicePreference = {
    gender: "female",
    accent: "Indian",
    variation: true,
    voiceIndex: undefined,
  };

  constructor() {
    this.speechSynthesis = window.speechSynthesis;

    // Load available voices
    this.loadVoices();

    // Update voices when they change
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = this.loadVoices.bind(this);
    }
  }

  private loadVoices(): void {
    // Get the available voices
    this.voices = this.speechSynthesis.getVoices();
    console.log(
      "Available voices:",
      this.voices.map((v) => `${v.name} (${v.lang})`)
    );
  }

  /**
   * Set voice preference
   * @param preference Voice preference settings
   */
  public setVoicePreference(preference: Partial<VoicePreference>): void {
    this.voicePreference = { ...this.voicePreference, ...preference };
    console.log("Voice preference set:", this.voicePreference);
  }

  /**
   * Get current voice preference
   */
  public getVoicePreference(): VoicePreference {
    return { ...this.voicePreference };
  }

  /**
   * Find the best voice matching the current preferences
   * @returns The best match voice or undefined if none found
   */
  private findBestMatchingVoice(): SpeechSynthesisVoice | undefined {
    if (this.voices.length === 0) return undefined;

    // If user has explicitly set a voice index, use that
    if (this.voicePreference.voiceIndex !== undefined) {
      return this.voices[this.voicePreference.voiceIndex];
    }

    const { gender, accent } = this.voicePreference;

    // Build a scoring function for voices based on preference
    const scoreVoice = (voice: SpeechSynthesisVoice): number => {
      let score = 0;

      // For female Indian accent
      if (gender === "female" && accent === "Indian") {
        // Directly prefer voices that match these criteria
        if (
          voice.name.toLowerCase().includes("female") &&
          (voice.name.toLowerCase().includes("india") ||
            voice.name.toLowerCase().includes("hindi") ||
            voice.lang === "hi-IN" ||
            voice.lang === "en-IN")
        ) {
          score += 100;
        }

        // Microsoft Heera is a good female Indian English voice
        if (voice.name.includes("Microsoft Heera")) {
          score += 150;
        }

        // Google Hindi voices
        if (voice.name.includes("Google") && voice.lang === "hi-IN") {
          score += 80;
        }

        // General female voice detection
        if (
          voice.name.toLowerCase().includes("female") ||
          voice.name.includes("Kalpana") ||
          voice.name.includes("Veena") ||
          voice.name.includes("Tara") ||
          voice.name.includes("Lekha")
        ) {
          score += 50;
        }

        // Any Hindi or Indian English
        if (voice.lang === "hi-IN" || voice.lang === "en-IN") {
          score += 30;
        }
      }

      // For male Indian accent
      if (gender === "male" && accent === "Indian") {
        if (
          voice.name.toLowerCase().includes("male") &&
          (voice.name.toLowerCase().includes("india") ||
            voice.name.toLowerCase().includes("hindi") ||
            voice.lang === "hi-IN" ||
            voice.lang === "en-IN")
        ) {
          score += 100;
        }

        // General male voice detection
        if (voice.name.toLowerCase().includes("male")) {
          score += 50;
        }

        // Any Hindi or Indian English
        if (voice.lang === "hi-IN" || voice.lang === "en-IN") {
          score += 30;
        }
      }

      // Default female voice
      if (gender === "female" && !accent) {
        if (voice.name.toLowerCase().includes("female")) {
          score += 50;
        }
      }

      // Default male voice
      if (gender === "male" && !accent) {
        if (voice.name.toLowerCase().includes("male")) {
          score += 50;
        }
      }

      // General en-US/en-GB quality voices as fallback
      if (voice.lang === "en-US" || voice.lang === "en-GB") {
        score += 10;
      }

      // Slightly prefer Google voices as they tend to be good quality
      if (voice.name.includes("Google")) {
        score += 5;
      }

      return score;
    };

    // Score all voices and pick the highest scoring one
    const scoredVoices = this.voices.map((voice) => ({
      voice,
      score: scoreVoice(voice),
    }));

    scoredVoices.sort((a, b) => b.score - a.score);

    // Log top 3 voices for debugging
    console.log(
      "Top voices for",
      this.voicePreference,
      ":",
      scoredVoices
        .slice(0, 3)
        .map((v) => `${v.voice.name} (${v.voice.lang}): ${v.score}`)
    );

    return scoredVoices[0]?.voice || this.voices[0];
  }

  /**
   * Convert text to speech
   * @param text The text to convert to speech
   * @param voiceIndex Optional index of the voice to use
   * @returns Promise that resolves when speech is done
   */
  public speak(text: string, voiceIndex?: number): Promise<void> {
    return new Promise(async (resolve) => {
      // Ensure user has interacted with the page
      if (!document.body.hasAttribute("data-user-interacted")) {
        console.log("Waiting for user interaction before speaking...");
        document.body.addEventListener(
          "click",
          () => {
            document.body.setAttribute("data-user-interacted", "true");
          },
          { once: true }
        );
      }
      if (!this.speechSynthesis) {
        console.error("Speech synthesis not supported");
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);

      // If explicit voice index is provided, use it
      if (voiceIndex !== undefined && this.voices.length > voiceIndex) {
        utterance.voice = this.voices[voiceIndex];
      } else {
        // Otherwise use voice preferences
        const bestMatchVoice = this.findBestMatchingVoice();
        utterance.voice = bestMatchVoice || this.voices[0];
      }

      // Log the selected voice
      console.log(
        "Using voice:",
        utterance.voice
          ? `${utterance.voice.name} (${utterance.voice.lang})`
          : "Default"
      );

      // Apply voice variations to prevent repetitive speech patterns
      if (this.voicePreference.variation) {
        // Generate a small random variation for pitch and rate
        // Use sentence length to influence variation (longer sentences get more variety)
        const sentenceCount = (text.match(/[.!?]+\s/g) || []).length + 1;
        const wordCount = text.split(/\s+/).length;

        // More variation for longer text
        const variationAmount = Math.min(0.15, 0.05 + wordCount / 200);

        // Random variation within a small range
        const pitchVariation =
          Math.random() * variationAmount * 2 - variationAmount;
        const rateVariation =
          Math.random() * variationAmount * 2 - variationAmount;

        // Base values
        let basePitch = 1.0;
        let baseRate = 1.0;

        // Configure speech parameters - slightly adjust for Indian accent if needed
        if (
          this.voicePreference.accent === "Indian" &&
          !utterance.voice?.name.toLowerCase().includes("india")
        ) {
          basePitch = 1.1; // Slightly higher pitch
          baseRate = 0.9; // Slightly slower rate
        }

        // Apply variations (ensuring they stay within reasonable bounds)
        utterance.pitch = Math.max(
          0.8,
          Math.min(1.2, basePitch + pitchVariation)
        );
        utterance.rate = Math.max(0.8, Math.min(1.2, baseRate + rateVariation));
      } else {
        // No variation - use standard parameters
        if (
          this.voicePreference.accent === "Indian" &&
          !utterance.voice?.name.toLowerCase().includes("india")
        ) {
          utterance.pitch = 1.1; // Slightly higher pitch
          utterance.rate = 0.9; // Slightly slower rate
        } else {
          utterance.pitch = 1.0;
          utterance.rate = 1.0;
        }
      }

      utterance.volume = 1.0;

      // Set up event handlers
      utterance.onstart = () => {
        this.speaking = true;
        this.notifySpeakingChange();
      };

      utterance.onend = () => {
        this.speaking = false;
        this.notifySpeakingChange();
        resolve();
      };

      utterance.onerror = (event) => {
        console.error("Speech synthesis error:", event);
        this.speaking = false;
        this.notifySpeakingChange();
        resolve();
      };

      // Speak the text
      this.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Stop current speaking
   */
  public stop(): void {
    if (this.speechSynthesis) {
      this.speechSynthesis.cancel();
      this.speaking = false;
      this.notifySpeakingChange();
    }
  }

  /**
   * Check if speech synthesis is currently speaking
   */
  public isSpeaking(): boolean {
    return this.speaking;
  }

  /**
   * Register a callback function to be notified when speaking state changes
   * @param callback Function to call when speaking state changes
   */
  public onSpeakingChange(callback: (speaking: boolean) => void): void {
    this.speakingCallbacks.push(callback);
    // Immediately call with current state
    callback(this.speaking);
  }

  /**
   * Remove a previously registered speaking callback
   * @param callback Function to remove
   */
  public removeSpeakingCallback(callback: (speaking: boolean) => void): void {
    this.speakingCallbacks = this.speakingCallbacks.filter(
      (cb) => cb !== callback
    );
  }

  /**
   * Toggle speech - start speaking if silent, stop if speaking
   * @param text Text to speak
   * @returns Promise that resolves when the action is complete
   */
  public toggleSpeech(text: string): Promise<void> {
    if (this.speaking) {
      this.stop();
      return Promise.resolve();
    } else {
      return this.speak(text);
    }
  }

  private notifySpeakingChange(): void {
    for (const callback of this.speakingCallbacks) {
      callback(this.speaking);
    }
  }

  /**
   * Get available voices
   * @returns Array of available voices
   */
  public getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }
}

// Create a singleton instance
const voiceService = new VoiceService();
export default voiceService;
