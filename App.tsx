import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Zap, StopCircle, Monitor, Smartphone, Play, Pause, Hand, AlertTriangle, Hourglass, Target, FastForward, Activity, Power, Lock, Unlock } from 'lucide-react';
import { fileToGenerativePart, analyzeGameState } from './services/gemini';
import { 
  getProfiles, saveProfile, deleteProfile, 
  saveLog, exportTrainingData, updateLogFeedback, getLogStats,
  saveErrorLog, exportErrorLogs, getSystemErrorCount, clearErrorLogs
} from './services/storage';
import { AnalysisResult, GameGenre, AppMode, GameProfile, TrainingLog, ErrorLog, FeedbackDetails, MacroStep, Point } from './types';
import { AnalysisView } from './components/AnalysisView';
import { VoiceControl } from './components/VoiceControl';

// --- GHOST CURSOR COMPONENT (HIGH PRECISION) ---
const GhostCursor = ({ x, y, isDown, type, precisionMode }: { x: number, y: number, isDown: boolean, type: string, precisionMode: boolean }) => (
  <div 
    className="absolute z-50 pointer-events-none transition-transform will-change-transform"
    style={{ 
      left: `${(x/1000)*100}%`, 
      top: `${(y/1000)*100}%`,
      transform: 'translate(-50%, -50%)',
      transitionDuration: isDown ? '50ms' : '100ms', // Snappier when clicking
      transitionTimingFunction: isDown ? 'step-end' : 'cubic-bezier(0.22, 1, 0.36, 1)' // Mechanical precision
    }}
  >
    {/* Precision Crosshair (Only appears when locking on target) */}
    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-100 ${precisionMode || isDown ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-[40px] h-[1px] bg-red-500/80"></div>
        <div className="h-[40px] w-[1px] bg-red-500/80 absolute"></div>
        <div className="w-[20px] h-[20px] border border-red-500/50 rounded-full absolute"></div>
    </div>

    {/* The Cursor/Finger */}
    <div className={`relative flex items-center justify-center transition-all duration-100 ${isDown ? 'scale-90' : 'scale-100'}`}>
      <div className={`w-8 h-8 rounded-full border-2 ${isDown ? 'bg-cyber-accent border-white shadow-[0_0_20px_rgba(255,255,255,0.8)]' : 'bg-black/30 border-cyber-accent shadow-[0_0_10px_rgba(0,240,255,0.4)]'} backdrop-blur-sm`}>
         <div className="absolute inset-0 bg-cyber-accent rounded-full opacity-20 animate-pulse"></div>
      </div>
      
      {/* Shockwave Effect when Clicking */}
      {isDown && (
        <div className="absolute inset-0 w-24 h-24 -ml-8 -mt-8 border-4 border-cyber-accent/80 rounded-full animate-[ping_0.3s_ease-out_infinite]"></div>
      )}
      
      {/* Icon inside cursor */}
      <Hand className={`w-4 h-4 absolute ${isDown ? 'text-black' : 'text-white'} ${isDown ? 'opacity-100' : 'opacity-80'}`} />
    </div>
    
    {/* Label */}
    <div className={`absolute top-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded border text-[9px] font-mono font-bold transition-colors ${
        isDown ? 'bg-cyber-accent text-black border-white' : 'bg-black/80 text-cyber-accent border-cyber-accent/30'
    }`}>
      {type}
    </div>
  </div>
);

export default function App() {
  const [mode, setMode] = useState<AppMode>('UPLOAD');
  
  // Data State
  const [profiles, setProfiles] = useState<GameProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newProfile, setNewProfile] = useState<Partial<GameProfile>>({ name: '', genre: GameGenre.UNKNOWN, notes: '' });

  // Analysis State
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasGivenFeedback, setHasGivenFeedback] = useState(false);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [retryTimer, setRetryTimer] = useState<number>(0);
  
  // Stats & UI
  const [logStats, setLogStats] = useState({ total: 0, accurate: 0, errors: 0 });
  const [systemErrorCount, setSystemErrorCount] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Ghost Cursor State
  const [cursorState, setCursorState] = useState<{ x: number, y: number, isDown: boolean, type: string, isVisible: boolean, precisionMode: boolean }>({
    x: 500, y: 500, isDown: false, type: 'IDLE', isVisible: false, precisionMode: false
  });
  
  // Auto-Pilot & Speed State
  const [isAutoPilot, setIsAutoPilot] = useState(true);
  const [momentum, setMomentum] = useState(1.0); // Speed multiplier

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number | null>(null);
  const retryIntervalRef = useRef<number | null>(null);
  const isLiveRef = useRef<boolean>(false);
  const voiceRef = useRef<{ speakSequence: (steps: any[]) => void } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isAutoPilotRef = useRef(isAutoPilot); // Ref for async access

  // Sync ref
  useEffect(() => {
    isAutoPilotRef.current = isAutoPilot;
  }, [isAutoPilot]);

  useEffect(() => {
    const loadedProfiles = getProfiles();
    setProfiles(loadedProfiles);
    if (loadedProfiles.length > 0) {
      const defaultProfile = loadedProfiles.find(p => p.id === 'universal_auto') || loadedProfiles[0];
      setSelectedProfileId(defaultProfile.id);
    } else {
      setShowTutorial(true); 
    }
    updateStats();
  }, []);

  const updateStats = () => {
    setLogStats(getLogStats());
    setSystemErrorCount(getSystemErrorCount());
  };

  const handleClearErrors = () => {
    clearErrorLogs();
    updateStats();
  };

  // --- GHOST CURSOR ANIMATION LOGIC (ADAPTIVE PRECISION) ---
  
  const animateSingleStep = useCallback(async (step: MacroStep | undefined) => {
    // CRITICAL FIX: Robust undefined check
    if (!step) {
        console.warn("Attempted to animate undefined step. Skipping.");
        return;
    }
    
    // Safety break if Auto-Pilot is disabled mid-sequence
    if (!isAutoPilotRef.current && mode !== 'UPLOAD') {
        return; 
    }

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    // Increase momentum (max 2.0x speed)
    setMomentum(prev => Math.min(prev + 0.1, 2.0));
    const speedFactor = momentum;

    setCursorState(prev => ({ ...prev, isVisible: true, precisionMode: false }));

    // 1. Travel Phase (Move to target)
    if (step.coordinates) {
       // Visual "Travel"
       setCursorState({ x: step.coordinates.x, y: step.coordinates.y, isDown: false, type: 'MOVE', isVisible: true, precisionMode: false });
       // Wait for travel (reduced by momentum)
       await new Promise(r => setTimeout(r, 200 / speedFactor)); 
    }

    // 2. Target Lock Phase (Brief pause for precision visual)
    if (step.coordinates && step.type !== 'WAIT') {
       setCursorState(prev => ({ ...prev, precisionMode: true })); // Show crosshair
       await new Promise(r => setTimeout(r, 50)); // 50ms lock-on time
    }

    // 3. Action Phase
    if (step.type === 'TAP') {
       // FORCE Exact Coordinates snap for click
       if (step.coordinates) {
           setCursorState(prev => ({ ...prev, x: step.coordinates.x, y: step.coordinates.y, isDown: true, type: 'TAP', precisionMode: true }));
       } else {
           setCursorState(prev => ({ ...prev, isDown: true, type: 'TAP', precisionMode: true }));
       }
       
       const pressDuration = 100 / speedFactor; // Faster taps with momentum
       await new Promise(r => setTimeout(r, pressDuration)); 
       
       setCursorState(prev => ({ ...prev, isDown: false, precisionMode: false }));
    } 
    else if ((step.type === 'SWIPE' || step.type === 'HUMAN_SWIPE' || step.type === 'DRAG') && step.coordinates && step.endCoordinates) {
       setCursorState(prev => ({ ...prev, isDown: true, type: step.type, precisionMode: false }));
       
       const startTime = performance.now();
       const baseDuration = step.durationMs || 500;
       const duration = baseDuration / speedFactor; 
       
       return new Promise<void>(resolve => {
          const animateSwipe = (currentTime: number) => {
             const elapsed = currentTime - startTime;
             const progress = Math.min(elapsed / duration, 1);
             
             // Easing function for natural movement
             const ease = step.type === 'HUMAN_SWIPE' ? (t: number) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t : (t: number) => t;

             if (step.coordinates && step.endCoordinates) {
                 const t = ease(progress);
                 const currentX = step.coordinates.x + (step.endCoordinates.x - step.coordinates.x) * t;
                 const currentY = step.coordinates.y + (step.endCoordinates.y - step.coordinates.y) * t;
                 
                 setCursorState({ x: currentX, y: currentY, isDown: true, type: step.type, isVisible: true, precisionMode: false });
             }

             if (progress < 1) {
                animationFrameRef.current = requestAnimationFrame(animateSwipe);
             } else {
                setCursorState(prev => ({ ...prev, isDown: false }));
                resolve();
             }
          };
          animationFrameRef.current = requestAnimationFrame(animateSwipe);
       });
    }
    else if (step.type === 'WAIT') {
       setCursorState(prev => ({ ...prev, type: 'WAIT...' }));
       await new Promise(r => setTimeout(r, step.durationMs));
    }
    
    // Post-action recovery (reduced by momentum)
    await new Promise(r => setTimeout(r, 100 / speedFactor));
  }, [momentum, mode]);

  const handleSaveProfile = () => {
    if (!newProfile.name) return;
    const profile: GameProfile = {
      id: Date.now().toString(),
      name: newProfile.name,
      genre: newProfile.genre || GameGenre.UNKNOWN,
      notes: newProfile.notes || ''
    };
    saveProfile(profile);
    setProfiles(getProfiles());
    setSelectedProfileId(profile.id);
    setIsEditingProfile(false);
    setNewProfile({ name: '', genre: GameGenre.UNKNOWN, notes: '' });
  };

  const triggerAnalysis = async (base64Images: string[]) => {
    setIsAnalyzing(true);
    setHasGivenFeedback(false);
    setSystemMessage(base64Images.length > 1 ? "Analyzing Motion Stream..." : "Hive Mind analyzing...");
    setRetryTimer(0);
    setMomentum(1.0); // Reset momentum on new analysis (Brain reset)

    if (retryIntervalRef.current) clearInterval(retryIntervalRef.current);
    
    let nextDelay = 3000; // Faster standard loop for Burst Mode

    const currentProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

    try {
      // --- CORE ANALYSIS CALL ---
      // We now pass array of images (Temporal Burst)
      const analysis = await analyzeGameState(base64Images, currentProfile);
      
      setResult(analysis);
      setError(null);
      setSystemMessage(`Analysis complete. ${analysis.motionVectors ? analysis.motionVectors.length + ' moving targets' : 'Static scene'}.`);
      
      // Auto-Learn Logic
      if (analysis.newlyDiscoveredRules && analysis.newlyDiscoveredRules.length > 0) {
        const newKnowledge = analysis.newlyDiscoveredRules.join('\n- ');
        if (!currentProfile.notes.includes(newKnowledge.substring(0, 20))) {
             const updatedProfile = {
               ...currentProfile,
               notes: `${currentProfile.notes}\n\n[AUTO-LEARNED ${new Date().toLocaleTimeString()}]:\n- ${newKnowledge}`
             };
             saveProfile(updatedProfile);
             setProfiles(getProfiles());
             setSystemMessage("New tactical data acquired and saved.");
        }
      }

      // Voice Feedback
      if (voiceRef.current && analysis.macroSequence) {
        voiceRef.current.speakSequence(analysis.macroSequence);
      }

      // Logging Success
      const logId = Date.now().toString();
      setCurrentLogId(logId);
      
      const logEntry: TrainingLog = {
        id: logId,
        gameId: currentProfile.id,
        timestamp: analysis.timestamp,
        imageHash: base64Images[0].substring(0, 30),
        aiPrediction: analysis
      };
      saveLog(logEntry);
      updateStats();

    } catch (e: any) {
      console.error("Critical Analysis Failure:", e);
      
      // --- ERROR HANDLING & LOGGING ---
      let technicalMessage = "Unknown Error";
      let friendlyMessage = "Analysis interrupted.";

      // Extract meaningful message
      if (typeof e === 'string') {
        technicalMessage = e;
      } else if (e instanceof Error) {
        technicalMessage = e.message;
        if (e.stack) technicalMessage += `\n${e.stack}`;
      } else {
        technicalMessage = JSON.stringify(e);
      }
      
      try {
        if (technicalMessage.trim().startsWith('{')) {
             const jsonErr = JSON.parse(technicalMessage);
             if (jsonErr.error && jsonErr.error.message) {
                 technicalMessage = jsonErr.error.message;
             }
        }
      } catch { /* Ignore parse error */ }

      // Categorize Error
      const isRateLimit = technicalMessage.includes("429") || technicalMessage.includes("quota") || technicalMessage.includes("RESOURCE_EXHAUSTED");
      const isSafety = technicalMessage.includes("SAFETY") || technicalMessage.includes("harmful");
      const isNetwork = technicalMessage.includes("fetch") || technicalMessage.includes("network");

      if (isRateLimit) {
         friendlyMessage = "Quota Exceeded. Cooling down neural link...";
         setSystemMessage("⚠ QUOTA EXCEEDED. PAUSING.");
         nextDelay = 25000; // 25s Cooldown
      } else if (isSafety) {
         friendlyMessage = "Safety filters triggered. Adjusting parameters.";
         nextDelay = 5000;
      } else if (isNetwork) {
         friendlyMessage = "Network uplink lost. Reconnecting...";
         nextDelay = 8000;
      } else {
         friendlyMessage = `System Error: ${technicalMessage.substring(0, 40)}...`;
         nextDelay = 5000;
      }

      const errLog: ErrorLog = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        severity: isRateLimit ? 'WARNING' : 'ERROR',
        message: technicalMessage,
        context: { mode, gameId: currentProfile.id, gameName: currentProfile.name }
      };
      saveErrorLog(errLog);
      updateStats();

      // Update UI
      if (isRateLimit) {
         setError(null); 
         setRetryTimer(nextDelay / 1000);
         retryIntervalRef.current = window.setInterval(() => {
              setRetryTimer(prev => Math.max(0, prev - 1));
         }, 1000);
      } else {
         setError(friendlyMessage);
         setSystemMessage("ERROR DETECTED. LOGGING EVENT.");
      }

    } finally {
      setIsAnalyzing(false);
      
      // --- RECURSIVE LOOP (Adaptive) ---
      // Only continue if Live Mode AND Auto-Pilot is Enabled
      if (isLiveRef.current && isAutoPilotRef.current) {
         timerRef.current = window.setTimeout(() => {
             captureAndAnalyze();
         }, nextDelay);
      } else if (isLiveRef.current && !isAutoPilotRef.current) {
         setSystemMessage("AUTO-PILOT STANDBY. Waiting for command.");
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMode('UPLOAD');
    stopLiveAnalysis();

    try {
      setError(null);
      const base64Data = await fileToGenerativePart(file);
      const dataUrl = `data:${file.type};base64,${base64Data}`;
      setCurrentImage(dataUrl);
      triggerAnalysis([base64Data]); // Send single image as array
    } catch (e) {
      setError("Failed to process image.");
    }
  };

  const stopLiveAnalysis = useCallback(() => {
    isLiveRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
        retryIntervalRef.current = null;
    }
    setRetryTimer(0);
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setSystemMessage("Visual systems offline.");
    setCursorState(prev => ({ ...prev, isVisible: false }));
  }, []);

  const startLiveAnalysis = async (useScreenShare: boolean = false) => {
    stopLiveAnalysis(); 
    setMode(useScreenShare ? 'SCREEN_SHARE' : 'LIVE_VISION');
    isLiveRef.current = true;
    setError(null);
    setResult(null);
    setSystemMessage(useScreenShare ? "Requesting Screen Link..." : "Visual systems online.");
    
    try {
      let stream: MediaStream;
      if (useScreenShare) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
           throw new Error("Screen Sharing API unavailable.");
        }
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.toLowerCase().includes("permission denied")) throw new Error("Permission Denied.");
          if (msg.toLowerCase().includes("permissions policy")) throw new Error("Blocked by browser policy. Open in new tab.");
          throw new Error(`Screen Link Failed: ${msg}`);
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current?.play();
      }
      
      captureAndAnalyze();

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setMode('UPLOAD');
      isLiveRef.current = false;
    }
  };

  // CAPTURE UTILITY
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context && video.videoWidth > 0) {
      let width = video.videoWidth;
      let height = video.videoHeight;
      const MAX_WIDTH = 1280;
      if (width > MAX_WIDTH) {
          const scale = MAX_WIDTH / width;
          width = MAX_WIDTH;
          height = height * scale;
      }
      canvas.width = width;
      canvas.height = height;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    }
    return null;
  }

  // UPDATED BURST MODE CAPTURE LOOP
  const captureAndAnalyze = async () => {
    if (!isLiveRef.current) return; 
    if (isAnalyzing || retryTimer > 0) return;
    
    // Check master switch
    if (!isAutoPilotRef.current) {
        // If Auto-Pilot disabled, check again in 1s (Standby mode)
        timerRef.current = window.setTimeout(captureAndAnalyze, 1000);
        return;
    }

    setSystemMessage("Capturing Frame Burst (Temporal Sync)...");
    
    // 1. Capture Frame A
    const frameA = captureFrame();
    
    // 2. Wait short duration (to allow motion to happen)
    await new Promise(r => setTimeout(r, 200)); 

    // 3. Capture Frame B
    const frameB = captureFrame();

    if (frameA && frameB) {
        triggerAnalysis([frameA, frameB]);
    } else {
        // Retry faster if capture failed
        timerRef.current = window.setTimeout(captureAndAnalyze, 500);
    }
  };

  const handleVoiceCommand = (command: string) => {
    if (command === 'ANALYZE') {
       // Manual Trigger overrides auto-pilot pause
       if (!isAutoPilot) setIsAutoPilot(true);
       if (mode === 'LIVE_VISION' || mode === 'SCREEN_SHARE') captureAndAnalyze();
    } else if (command === 'STOP') {
      setIsAutoPilot(false);
      stopLiveAnalysis();
      setMode('UPLOAD');
    }
  };

  const handleFeedback = (feedback: FeedbackDetails) => {
    if (currentLogId) {
      updateLogFeedback(currentLogId, feedback);
      setHasGivenFeedback(true);
      updateStats();
    }
  };

  useEffect(() => { return () => stopLiveAnalysis(); }, [stopLiveAnalysis]);

  const getTargetStyle = (x?: number, y?: number) => {
    if (x === undefined || y === undefined) return { display: 'none' };
    return { top: `${(y/1000)*100}%`, left: `${(x/1000)*100}%`, display: 'flex' };
  };
  
  const getCurvePath = (x1: number, y1: number, x2: number, y2: number) => {
    const startX = (x1 / 1000) * 100;
    const startY = (y1 / 1000) * 100;
    const endX = (x2 / 1000) * 100;
    const endY = (y2 / 1000) * 100;
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const offset = 15; 
    const controlX = midX - (dy / len) * offset;
    const controlY = midY + (dx / len) * offset;
    return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
  };

  return (
    <div className="min-h-screen bg-cyber-900 text-gray-100 font-sans selection:bg-cyber-accent selection:text-black overflow-hidden flex flex-col md:flex-row">
      <canvas ref={canvasRef} className="hidden" />

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cyber-900 border border-cyber-accent rounded-lg max-w-lg w-full p-6 shadow-[0_0_50px_rgba(0,240,255,0.2)]">
            <h2 className="text-2xl font-bold font-mono text-cyber-accent mb-4">NEXUS V15 TEMPORAL</h2>
            <div className="space-y-4 text-gray-300">
               <p>The <strong>Omniscience Engine</strong> has been upgraded with Temporal Video Analysis.</p>
               <div className="bg-black/50 p-4 rounded border border-gray-700">
                <h3 className="font-bold text-white mb-2 flex items-center gap-2"><FastForward size={16} className="text-cyber-accent"/> BURST CAPTURE MODE:</h3>
                <p className="text-xs mb-2">
                  The system now analyzes <strong>motion</strong> by capturing multiple frames. It predicts where enemies WILL BE, not just where they are.
                </p>
                <h3 className="font-bold text-white mb-2 flex items-center gap-2"><Target size={16} className="text-cyber-accent"/> PREDICTIVE AIMING:</h3>
                <p className="text-xs">
                   Auto-compensation for moving targets and stabilized Text Reading (Deep OCR) for flickering UI.
                </p>
              </div>
            </div>
            <button onClick={() => setShowTutorial(false)} className="mt-6 w-full py-3 bg-cyber-accent text-black font-bold rounded hover:bg-white transition-colors">INITIALIZE</button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-full md:w-72 bg-black/60 border-r border-cyber-800 flex flex-col z-20 backdrop-blur-md">
        {/* ... Sidebar Content ... */}
        <div className="p-4 border-b border-cyber-800 flex items-center gap-3">
          <div className="p-2 bg-cyber-500/10 rounded-lg border border-cyber-500/50">
            <Smartphone className="text-cyber-accent w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-white">NEXUS V15</h1>
            <p className="text-[10px] text-cyber-400 uppercase tracking-[0.2em]">TEMPORAL Engine</p>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-4">
             {/* Profile Selector */}
             <div>
               <label className="text-[10px] font-mono text-gray-500 uppercase block mb-1">Game Profile</label>
               <select 
                 value={selectedProfileId} 
                 onChange={(e) => setSelectedProfileId(e.target.value)}
                 className="w-full bg-black/50 border border-cyber-800 text-gray-300 text-sm rounded p-2"
               >
                 {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
               </select>
            </div>
            {/* Stats */}
            <div className="bg-cyber-900/40 border border-cyber-800 rounded p-3 grid grid-cols-3 gap-2 text-center">
               <div><div className="text-lg font-bold text-white">{logStats.total}</div><div className="text-[9px] text-gray-500">OPS</div></div>
               <div><div className="text-lg font-bold text-green-400">{logStats.accurate}</div><div className="text-[9px] text-gray-500">OK</div></div>
               <div><div className="text-lg font-bold text-red-400">{logStats.errors}</div><div className="text-[9px] text-gray-500">ERR</div></div>
            </div>
            {/* Buttons */}
             <button onClick={exportTrainingData} className="w-full py-2 bg-cyber-900/50 border border-cyber-800 text-xs text-cyber-400 rounded hover:bg-cyber-800">EXPORT BRAIN</button>
             {systemErrorCount > 0 && <button onClick={handleClearErrors} className="w-full py-2 bg-red-900/20 text-red-400 text-xs rounded border border-red-900">CLEAR ERRORS</button>}
        </div>
      </aside>

      {/* Main Interface */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,30,0.3)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,30,0.3)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

        {/* HUD Header */}
        <header className="h-14 border-b border-cyber-800 bg-cyber-900/90 flex items-center justify-between px-4 z-10 backdrop-blur">
          <VoiceControl ref={voiceRef} onCommand={handleVoiceCommand} isProcessing={isAnalyzing} systemMessage={systemMessage} />
          
          <div className="flex gap-2 items-center">
             {/* MASTER AUTO-PILOT SWITCH */}
             {(mode === 'LIVE_VISION' || mode === 'SCREEN_SHARE') && (
                 <button 
                    onClick={() => setIsAutoPilot(!isAutoPilot)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-bold transition-all ${
                        isAutoPilot 
                        ? 'bg-green-900/20 border-green-500 text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.2)]' 
                        : 'bg-gray-800 border-gray-600 text-gray-400'
                    }`}
                 >
                     {isAutoPilot ? <Unlock size={14} /> : <Lock size={14} />}
                     {isAutoPilot ? 'AUTO-PILOT ON' : 'MANUAL MODE'}
                 </button>
             )}

             <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
             {mode === 'LIVE_VISION' || mode === 'SCREEN_SHARE' ? (
               <button onClick={() => { setMode('UPLOAD'); stopLiveAnalysis(); }} className="flex items-center gap-2 px-3 py-1.5 bg-red-900/80 hover:bg-red-900 text-white text-xs font-bold rounded border border-red-500 animate-pulse">
                 <StopCircle size={14} /> STOP UPLINK
               </button>
             ) : (
               <>
                  <button onClick={() => fileInputRef.current?.click()} className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-cyber-800 text-gray-300 text-xs rounded border border-cyber-600 hover:text-white"><Upload size={14} /> UPLOAD</button>
                  <button onClick={() => startLiveAnalysis(true)} className="flex items-center gap-2 px-3 py-1.5 bg-cyber-700 text-white text-xs font-bold rounded border border-cyber-500 hover:bg-cyber-600"><Monitor size={14} /> SCREEN LINK</button>
                  <button onClick={() => startLiveAnalysis(false)} className="flex items-center gap-2 px-3 py-1.5 bg-cyber-accent text-black text-xs font-bold rounded shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:bg-white"><Smartphone size={14} /> CAM LINK</button>
               </>
             )}
          </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 p-4 flex flex-col lg:flex-row gap-4 overflow-hidden">
          
          {/* Camera / Feed Area */}
          <div className="flex-1 relative bg-black rounded-lg border border-cyber-800 shadow-2xl flex items-center justify-center overflow-hidden group">
             {/* Reticle */}
             <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border border-cyber-accent/50 rounded-full flex items-center justify-center"><div className="w-1 h-1 bg-cyber-accent"></div></div>
             </div>

             <div className={`w-full h-full flex items-center justify-center ${mode === 'LIVE_VISION' || mode === 'SCREEN_SHARE' ? 'block' : 'hidden'}`}>
                <video ref={videoRef} className="max-w-full max-h-full" playsInline muted />
             </div>
             
             {mode === 'UPLOAD' && currentImage && (
               <img src={currentImage} className="max-w-full max-h-full object-contain opacity-90" alt="Analysis" />
             )}

             {/* GHOST CURSOR - THE VIRTUAL PLAYER */}
             {cursorState.isVisible && (
                <GhostCursor 
                  x={cursorState.x} 
                  y={cursorState.y} 
                  isDown={cursorState.isDown} 
                  type={cursorState.type} 
                  precisionMode={cursorState.precisionMode}
                />
             )}

             {/* Augmented Reality Vectors & Motion Data */}
             <div className="absolute inset-0 pointer-events-none">
                <svg className="w-full h-full">
                  {/* Motion Vectors (Temporal Analysis) */}
                  {result?.motionVectors?.map((mv, idx) => (
                      <g key={`mv-${idx}`}>
                        <line x1={`${mv.from.x/10}%`} y1={`${mv.from.y/10}%`} x2={`${mv.to.x/10}%`} y2={`${mv.to.y/10}%`} stroke="#f00" strokeWidth="2" strokeOpacity="0.6" />
                        <circle cx={`${mv.to.x/10}%`} cy={`${mv.to.y/10}%`} r="3" fill="red" />
                        <text x={`${mv.to.x/10}%`} y={`${mv.to.y/10}%`} fill="red" fontSize="10" dx="5" dy="-5">{mv.element} ({mv.velocity})</text>
                      </g>
                  ))}

                  {/* Macro Vectors */}
                  {result?.macroSequence?.map((step, idx) => {
                    if ((step.type === 'SWIPE' || step.type === 'DRAG' || step.type === 'HUMAN_SWIPE') && step.coordinates && step.endCoordinates) {
                       // Draw Curve for Human Swipe
                       if (step.type === 'HUMAN_SWIPE') {
                          return <path key={`curve-${idx}`} d={getCurvePath(step.coordinates.x, step.coordinates.y, step.endCoordinates.x, step.endCoordinates.y)} stroke="#00f0ff" strokeWidth="3" fill="none" strokeLinecap="round" className="drop-shadow-[0_0_5px_#00f0ff] opacity-80" />;
                       }
                       // Draw Line for normal swipe
                       return <line key={`line-${idx}`} x1={`${step.coordinates.x / 10}%`} y1={`${step.coordinates.y / 10}%`} x2={`${step.endCoordinates.x / 10}%`} y2={`${step.endCoordinates.y / 10}%`} stroke="#00f0ff" strokeWidth="2" strokeDasharray="5,5" className="opacity-50" />;
                    }
                    return null;
                  })}
                </svg>
                {/* Target Indicators */}
                {result?.macroSequence?.map((step, idx) => (
                    <div key={idx} className="absolute w-6 h-6 z-20 -ml-3 -mt-3 flex items-center justify-center pointer-events-none" style={getTargetStyle(step.coordinates?.x, step.coordinates?.y)}>
                      <div className="absolute inset-0 bg-cyber-accent/30 rounded-full animate-ping"></div>
                      <div className="w-2 h-2 bg-cyber-accent rounded-full shadow-[0_0_10px_#00f0ff]"></div>
                      <span className="absolute -top-5 bg-black/80 text-cyber-accent text-[9px] px-1 border border-cyber-accent/50 rounded">{idx + 1}</span>
                    </div>
                ))}
             </div>

             {/* Retry Countdown Overlay */}
             {retryTimer > 0 && (
                 <div className="absolute inset-0 bg-black/60 z-40 flex flex-col items-center justify-center backdrop-blur-sm animate-fadeIn">
                     <div className="bg-cyber-900 border border-cyber-accent rounded-lg p-6 shadow-2xl flex flex-col items-center">
                         <Hourglass className="w-12 h-12 text-cyber-accent animate-spin mb-4" />
                         <div className="text-3xl font-mono font-bold text-white mb-1">{retryTimer}s</div>
                         <div className="text-xs text-cyber-400 font-mono tracking-widest uppercase">Cooling Down Systems</div>
                         <div className="text-[10px] text-gray-500 mt-2">Rate Limit Protection Active</div>
                     </div>
                 </div>
             )}

             {/* Error / Status Overlay */}
             {error && retryTimer === 0 && (
               <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-4 py-2 rounded border border-red-500 font-mono text-xs animate-pulse z-30 flex items-center gap-2 shadow-lg backdrop-blur">
                  <AlertTriangle size={14} className="text-yellow-400" />
                  {error}
               </div>
             )}
             
             {/* PAUSED OVERLAY */}
             {mode !== 'UPLOAD' && !isAutoPilot && (
                 <div className="absolute top-4 left-4 z-30 flex items-center gap-2 bg-gray-900/80 border border-gray-600 rounded px-2 py-1">
                     <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                     <span className="text-[10px] text-gray-400 font-mono">STANDBY</span>
                 </div>
             )}
          </div>

          {/* Tactical Display */}
          <div className="w-full lg:w-[400px] bg-cyber-900/80 border border-cyber-800 rounded-lg flex flex-col backdrop-blur-md shadow-xl h-1/2 lg:h-full">
            <div className="p-3 border-b border-cyber-800 flex justify-between items-center bg-black/40">
              <span className="text-xs font-bold font-mono text-cyber-400">TACTICAL DISPLAY</span>
              {mode !== 'UPLOAD' && (
                  <div className={`flex items-center gap-1 text-[9px] ${isAutoPilot ? 'text-cyber-accent animate-pulse' : 'text-gray-500'}`}>
                      <Activity size={10} />
                      <span>{isAutoPilot ? 'TEMPORAL SYNC ACTIVE' : 'SYSTEM PAUSED'}</span>
                  </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <AnalysisView 
                  result={result} 
                  isLoading={isAnalyzing} 
                  onFeedback={handleFeedback} 
                  hasGivenFeedback={hasGivenFeedback}
                  onPreviewStep={isAutoPilot ? animateSingleStep : undefined}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}