
import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { MacroStep } from '../types';

interface VoiceControlProps {
  onCommand: (command: string) => void;
  isProcessing: boolean;
  systemMessage: string | null;
}

export interface VoiceControlHandle {
  speakSequence: (steps: MacroStep[]) => void;
}

export const VoiceControl = forwardRef<VoiceControlHandle, VoiceControlProps>(({ onCommand, isProcessing, systemMessage }, ref) => {
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const recognitionRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    speakSequence: (steps: MacroStep[]) => {
      if (isMuted) return;
      // Synthesize the full sequence naturally
      const phrases = steps.map(s => {
        if (s.type === 'WAIT') return `Wait ${s.durationMs / 1000} seconds.`;
        return `${s.description}.`;
      });
      speak(phrases.join(" Then, "));
    }
  }));

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US'; 

      recognitionRef.current.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        const command = lastResult[0].transcript.trim().toLowerCase();
        console.log("Voice Command:", command);
        
        if (command.includes('analyze') || command.includes('scan') || command.includes('check')) {
          onCommand('ANALYZE');
          speak("Scanning.");
        } else if (command.includes('stop') || command.includes('cancel')) {
          onCommand('STOP');
          speak("Aborted.");
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        // console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }
  }, [onCommand]);

  // TTS Effect
  useEffect(() => {
    if (systemMessage && !isMuted) {
      speak(systemMessage);
    }
  }, [systemMessage, isMuted]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1;
      
      const voices = window.speechSynthesis.getVoices();
      // Prefer a natural voice if available
      const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        speak("Voice command ready.");
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="flex gap-2">
      <button 
        onClick={() => setIsMuted(!isMuted)}
        className={`p-2 rounded border transition-all ${isMuted ? 'bg-gray-800 text-gray-500 border-gray-700' : 'bg-cyber-900/50 text-cyber-accent border-cyber-accent/30'}`}
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      
      <button 
        onClick={toggleListening}
        className={`flex items-center gap-2 px-3 py-2 rounded border transition-all ${
          isListening 
            ? 'bg-red-900/20 text-red-400 border-red-500 animate-pulse' 
            : 'bg-cyber-900/50 text-cyber-400 border-cyber-700 hover:text-cyber-accent'
        }`}
      >
        {isListening ? (
          <>
            <Mic size={18} /> 
            <span className="hidden md:inline text-xs font-mono uppercase">Listening</span>
          </>
        ) : (
          <>
            <MicOff size={18} />
            <span className="hidden md:inline text-xs font-mono uppercase">Voice Off</span>
          </>
        )}
      </button>
    </div>
  );
});

VoiceControl.displayName = 'VoiceControl';
