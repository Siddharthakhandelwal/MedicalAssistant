import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatContext } from '../context/ChatContext';
import { useSpeechRecognition } from './useSpeechRecognition';
import voiceService from '../services/VoiceService';
import { QuickActionButton } from '../types';

export const useChatbot = () => {
  const {
    messages,
    isLoading,
    sendMessage,
    quickActions
  } = useChatContext();
  
  const [inputValue, setInputValue] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListeningForVoice, setIsListeningForVoice] = useState(false);
  
  // Reference to scroll to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize speech recognition
  const {
    transcript,
    isListening,
    startListening,
    stopListening,
    hasRecognitionSupport,
    resetTranscript
  } = useSpeechRecognition();
  
  // Scroll to bottom of messages when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Set up voice service speaking change listener
  useEffect(() => {
    voiceService.onSpeakingChange(handleSpeakingChange);
    
    return () => {
      voiceService.removeSpeakingCallback(handleSpeakingChange);
    };
  }, []);
  
  // Update input value when transcript changes
  useEffect(() => {
    if (transcript) {
      setInputValue(transcript);
    }
  }, [transcript]);
  
  // Handle speaking state changes
  const handleSpeakingChange = (speaking: boolean) => {
    setIsSpeaking(speaking);
  };
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  // Handle voice input
  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
      setIsListeningForVoice(false);
    } else {
      startListening();
      setIsListeningForVoice(true);
    }
  };
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Handle key press (for Enter key)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Send message
  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return;
    
    // Stop voice input if active
    if (isListening) {
      stopListening();
      setIsListeningForVoice(false);
    }
    
    const message = inputValue;
    setInputValue('');
    resetTranscript();
    
    await sendMessage(message);
  };
  
  // Handle quick action click
  const handleQuickAction = async (actionText: string) => {
    if (isLoading) return;
    
    await sendMessage(actionText);
  };
  
  // Stop speech
  const stopSpeech = () => {
    if (isSpeaking) {
      voiceService.stop();
    }
  };
  
  return {
    messages,
    isLoading,
    inputValue,
    quickActions,
    messagesEndRef,
    isListening,
    isSpeaking,
    hasRecognitionSupport,
    isListeningForVoice,
    handleSendMessage,
    handleQuickAction,
    handleInputChange,
    handleKeyPress,
    toggleVoiceInput,
    stopSpeech
  };
};