
export interface Point {
  x: number;
  y: number;
}

export interface SwipeConfig {
  speed: number;        // 0.5 (slow) to 2.0 (fast)
  randomness: number;   // 0 to 50px jitter
  curveIntensity: number; // 0 (straight) to 1.0 (arc)
}

export interface MacroStep {
  id: string;
  type: 'TAP' | 'SWIPE' | 'WAIT' | 'DRAG' | 'HUMAN_SWIPE';
  coordinates?: Point;
  endCoordinates?: Point; // For swipes/drags
  durationMs: number; // For waits or holds
  description: string;
  swipeConfig?: SwipeConfig; // Optional config for human-like movement
  targetText?: string; // OCR text targeted by this action
}

export type GamePhase = 'BOOT' | 'LOGIN' | 'LOADING' | 'CINEMATIC' | 'TUTORIAL' | 'MENU' | 'GAMEPLAY' | 'AD' | 'ERROR';

export interface MotionVector {
  element: string;
  from: Point;
  to: Point;
  velocity: string; // "Fast", "Static", "Slow"
}

export interface AnalysisResult {
  phase: GamePhase;
  title: string;
  summary: string;
  macroSequence: MacroStep[]; 
  detectedElements: string[]; 
  motionVectors?: MotionVector[]; // New: Temporal analysis data
  extractedText?: string[]; // New: Full OCR dump
  newlyDiscoveredRules: string[]; 
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedWinRate: number;
  timestamp: number;
}

export interface GameProfile {
  id: string;
  name: string;
  genre: GameGenre;
  notes: string;
}

export interface FeedbackDetails {
  isAccurate: boolean;
  correctionType?: 'WRONG_ACTION' | 'MISSED_THREAT' | 'BAD_TARGET' | 'WRONG_COORDINATES' | 'OTHER';
  suggestedAction?: string;
  notes?: string;
}

export interface TrainingLog {
  id: string;
  gameId: string;
  timestamp: number;
  imageHash: string;
  aiPrediction: AnalysisResult;
  userFeedback?: FeedbackDetails;
}

export interface ErrorLog {
  id: string;
  timestamp: number;
  severity: 'WARNING' | 'ERROR' | 'FATAL';
  message: string;
  stack?: string;
  context: {
    mode: AppMode;
    gameId?: string;
    gameName?: string;
  };
}

export enum GameGenre {
  STRATEGY = 'Strategy / RTS',
  PUZZLE = 'Puzzle / Match-3',
  RPG = 'RPG / Turn-Based',
  ACTION = 'Action / FPS',
  MOBA = 'MOBA / Arena',
  UNKNOWN = 'General / Other'
}

export type AppMode = 'UPLOAD' | 'LIVE_VISION' | 'SCREEN_SHARE';

export interface VoiceState {
  isListening: boolean;
  isSpeaking: boolean;
  lastCommand: string | null;
}
