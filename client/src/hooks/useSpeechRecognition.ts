import { useState, useEffect, useCallback } from "react";

interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  hasRecognitionSupport: boolean;
  resetTranscript: () => void;
}

// Define a type for the Web Speech API's SpeechRecognition
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: any) => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

// Get the SpeechRecognition constructor
const getSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  if (typeof window === "undefined") {
    return null;
  }

  // Use window with any to access browser-specific implementations
  const windowWithSpeech = window as any;
  return (windowWithSpeech.SpeechRecognition ||
    windowWithSpeech.webkitSpeechRecognition ||
    null) as unknown as SpeechRecognitionConstructor;
};

/**
 * Custom hook for speech recognition functionality
 */
export const useSpeechRecognition = (
  options: SpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn => {
  const [transcript, setTranscript] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);

  // Check if speech recognition is supported
  const SpeechRecognition = getSpeechRecognition();
  const hasRecognitionSupport = !!SpeechRecognition;

  // Reference to the recognition instance
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(
    null
  );

  // Initialize recognition
  useEffect(() => {
    if (!hasRecognitionSupport) return;

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = options.continuous ?? true;
    recognitionInstance.interimResults = options.interimResults ?? true;
    recognitionInstance.lang = options.lang ?? "en-US";

    setRecognition(recognitionInstance);

    return () => {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
    };
  }, [
    hasRecognitionSupport,
    options.continuous,
    options.interimResults,
    options.lang,
  ]);

  // Start listening function
  const startListening = useCallback(() => {
    if (!recognition) return;

    // Set up event listeners
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          currentTranscript += result[0].transcript;
        }
      }

      setTranscript((prev) => prev + " " + currentTranscript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event);
      setIsListening(false);
    };

    // Start recognition
    try {
      recognition.start();
      setIsListening(true);

      // Handle auto-termination by restarting if needed
      const keepAliveHandler = () => {
        if (isListening) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore "already started" errors
            if (e instanceof Error && !e.message.includes("already started")) {
              console.error("Error restarting speech recognition", e);
            }
          }
        }
      };

      // Override onend to keep recognition alive
      const originalOnEnd = recognition.onend;
      recognition.onend = () => {
        if (isListening) {
          keepAliveHandler();
        } else if (originalOnEnd) {
          originalOnEnd.call(recognition);
        }
      };
    } catch (error) {
      console.error("Error starting speech recognition", error);
    }
  }, [recognition, isListening]);

  // Stop listening function
  const stopListening = useCallback(() => {
    if (!recognition) return;

    recognition.stop();
    setIsListening(false);
  }, [recognition]);

  // Reset transcript
  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    hasRecognitionSupport,
    resetTranscript,
  };
};

export default useSpeechRecognition;
