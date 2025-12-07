import React, { useEffect, useState, useRef } from 'react';
import { MacroStep, SwipeConfig } from '../types';
import { Play, Check, Clock, MousePointer2, Move, Hand, Activity, Sliders, Fingerprint, Pause, SkipForward, SkipBack } from 'lucide-react';

interface MacroViewProps {
  sequence: MacroStep[];
  isPlaying: boolean;
  onPreviewStep?: (step: MacroStep) => Promise<void>;
}

export const MacroView: React.FC<MacroViewProps> = ({ sequence, isPlaying: initialIsPlaying, onPreviewStep }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [showConfig, setShowConfig] = useState(false);
  const [isLocallyPlaying, setIsLocallyPlaying] = useState(initialIsPlaying);
  const isPlayingRef = useRef(initialIsPlaying);

  // Simulation Config (Controller Logic)
  const [globalSwipeConfig, setGlobalSwipeConfig] = useState<SwipeConfig>({
    speed: 1.0,
    randomness: 10,
    curveIntensity: 0.5
  });

  // Sync ref with state for async loop
  useEffect(() => {
    isPlayingRef.current = isLocallyPlaying;
  }, [isLocallyPlaying]);

  // When sequence changes (new analysis), reset and autoplay
  useEffect(() => {
      if (sequence && sequence.length > 0) {
          setCurrentStepIndex(0);
          setIsLocallyPlaying(true);
      } else {
          setCurrentStepIndex(-1);
          setIsLocallyPlaying(false);
      }
  }, [sequence]); // Only reset when the array itself changes (new analysis)

  // Playback Loop
  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | null = null;

    const playLoop = async () => {
        if (!sequence || sequence.length === 0) return;
        
        // Loop while playing and not at end
        while (isMounted && isPlayingRef.current) {
            
            // Get current index from state, or default to 0
            let idx = -1;
            setCurrentStepIndex(prev => { idx = prev; return prev; });
            
            // If finished, stop
            if (idx >= sequence.length) {
                setIsLocallyPlaying(false);
                break;
            }

            // Animate Current Step
            const stepData = sequence[idx];
            
            // CRITICAL FIX: Ensure stepData exists
            if (!stepData) {
                // If index is invalid, stop loop
                setIsLocallyPlaying(false);
                break;
            }

            // Trigger Visual Ghost
            if (onPreviewStep) {
                try {
                  await onPreviewStep(stepData);
                } catch (e) {
                  console.warn("Animation skipped for step", stepData);
                }
            }

            // Determine Duration (minimum 500ms for visibility if duration is 0)
            let duration = Math.max(stepData.durationMs, 500);
            if (stepData.type === 'HUMAN_SWIPE' || stepData.type === 'SWIPE') {
                duration = duration / globalSwipeConfig.speed;
            }

            // Wait if no onPreviewStep (fallback) or additional wait time
            if (!onPreviewStep) {
                await new Promise(r => setTimeout(r, duration));
            }

            if (!isMounted || !isPlayingRef.current) break;

            // Advance Step
            setCurrentStepIndex(prev => prev + 1);
            
            // Small pause between steps
            await new Promise(r => setTimeout(r, 200));
        }
    };

    if (isLocallyPlaying) {
        playLoop();
    }

    return () => {
        isMounted = false;
        if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLocallyPlaying, sequence, globalSwipeConfig, onPreviewStep]);


  // Controls
  const togglePlay = () => setIsLocallyPlaying(!isLocallyPlaying);
  
  const stepForward = () => {
      setIsLocallyPlaying(false);
      const nextIndex = Math.min(currentStepIndex + 1, sequence.length - 1);
      setCurrentStepIndex(nextIndex);
      if (sequence && sequence[nextIndex] && onPreviewStep) {
         onPreviewStep(sequence[nextIndex]);
      }
  };

  const stepBackward = () => {
      setIsLocallyPlaying(false);
      const prevIndex = Math.max(currentStepIndex - 1, 0);
      setCurrentStepIndex(prevIndex);
      if (sequence && sequence[prevIndex] && onPreviewStep) {
         onPreviewStep(sequence[prevIndex]);
      }
  };


  const getIcon = (type: string) => {
    switch (type) {
      case 'TAP': return <MousePointer2 size={14} />;
      case 'SWIPE': return <Move size={14} />;
      case 'HUMAN_SWIPE': return <Fingerprint size={14} className="text-cyber-accent" />;
      case 'WAIT': return <Clock size={14} />;
      case 'DRAG': return <Hand size={14} />;
      default: return <MousePointer2 size={14} />;
    }
  };

  if (!sequence || sequence.length === 0) {
      return (
          <div className="mt-4 p-3 bg-black/40 border border-cyber-800 rounded text-center text-gray-500 text-xs font-mono">
              NO ACTION SEQUENCE GENERATED
          </div>
      );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-mono text-cyber-accent uppercase tracking-wider">Automation Sequence</h4>
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowConfig(!showConfig)}
                className={`p-1 rounded hover:bg-cyber-800 ${showConfig ? 'text-cyber-accent' : 'text-gray-500'}`}
                title="Controller Settings"
            >
                <Sliders size={12} />
            </button>
            <div className="text-[10px] text-gray-500">{sequence.length} STEPS</div>
        </div>
      </div>
      
      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4 mb-3 bg-black/30 p-2 rounded border border-cyber-800/50">
         <button onClick={stepBackward} className="text-gray-400 hover:text-white transition-colors" title="Previous Step">
             <SkipBack size={16} />
         </button>
         <button onClick={togglePlay} className="w-8 h-8 flex items-center justify-center rounded-full bg-cyber-800 hover:bg-cyber-700 text-cyber-accent border border-cyber-600 transition-all shadow-[0_0_10px_rgba(99,102,241,0.2)]">
             {isLocallyPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
         </button>
         <button onClick={stepForward} className="text-gray-400 hover:text-white transition-colors" title="Next Step">
             <SkipForward size={16} />
         </button>
      </div>
      
      {/* Human Controller Config Panel */}
      {showConfig && (
        <div className="mb-3 p-3 bg-black/40 border border-cyber-800 rounded animate-fadeIn">
            <h5 className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1">
                <Activity size={10} /> HUMAN SIMULATION PARAMETERS
            </h5>
            <div className="space-y-2">
                <div>
                    <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                        <span>SPEED MULTIPLIER</span>
                        <span>{globalSwipeConfig.speed}x</span>
                    </div>
                    <input 
                        type="range" min="0.5" max="2.0" step="0.1"
                        value={globalSwipeConfig.speed}
                        onChange={(e) => setGlobalSwipeConfig({...globalSwipeConfig, speed: parseFloat(e.target.value)})}
                        className="w-full h-1 bg-cyber-900 rounded-lg appearance-none cursor-pointer accent-cyber-accent"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                        <span>JITTER / RANDOMNESS</span>
                        <span>{globalSwipeConfig.randomness}px</span>
                    </div>
                    <input 
                        type="range" min="0" max="50" step="1"
                        value={globalSwipeConfig.randomness}
                        onChange={(e) => setGlobalSwipeConfig({...globalSwipeConfig, randomness: parseFloat(e.target.value)})}
                        className="w-full h-1 bg-cyber-900 rounded-lg appearance-none cursor-pointer accent-cyber-accent"
                    />
                </div>
                <div>
                    <div className="flex justify-between text-[9px] text-gray-500 mb-1">
                        <span>CURVE INTENSITY</span>
                        <span>{Math.round(globalSwipeConfig.curveIntensity * 100)}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.1"
                        value={globalSwipeConfig.curveIntensity}
                        onChange={(e) => setGlobalSwipeConfig({...globalSwipeConfig, curveIntensity: parseFloat(e.target.value)})}
                        className="w-full h-1 bg-cyber-900 rounded-lg appearance-none cursor-pointer accent-cyber-accent"
                    />
                </div>
            </div>
        </div>
      )}

      <div className="space-y-2 relative">
        {/* Connection Line */}
        <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-cyber-800 z-0"></div>

        {sequence.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const isDone = idx < currentStepIndex;
          
          return (
            <div 
              key={idx} 
              className={`relative z-10 flex items-center gap-3 p-2 rounded border transition-all ${
                isActive 
                  ? 'bg-cyber-800/80 border-cyber-accent shadow-[0_0_10px_rgba(0,240,255,0.1)]' 
                  : isDone
                    ? 'bg-green-900/10 border-green-900/30 opacity-60'
                    : 'bg-black/40 border-cyber-800 text-gray-500'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                isActive ? 'bg-cyber-accent text-black border-cyber-accent' : 
                isDone ? 'bg-green-500 text-black border-green-500' : 'bg-cyber-900 border-cyber-700'
              }`}>
                {isDone ? <Check size={12} /> : <span className="text-[10px] font-mono">{idx + 1}</span>}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={isActive ? 'text-white' : 'text-gray-400'}>{getIcon(step.type)}</span>
                  <span className={`text-xs font-bold uppercase ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {step.type === 'HUMAN_SWIPE' ? 'HUMAN GESTURE' : step.type}
                  </span>
                  {step.coordinates && (
                    <span className="text-[10px] font-mono text-gray-600">
                      [{Math.round(step.coordinates.x)}, {Math.round(step.coordinates.y)}]
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400">{step.description}</p>
                {step.type === 'HUMAN_SWIPE' && (
                    <div className="text-[9px] text-cyber-500 flex gap-2 mt-1">
                        <span>~{globalSwipeConfig.randomness}px jitter</span>
                        <span>{Math.round(globalSwipeConfig.curveIntensity*100)}% curve</span>
                    </div>
                )}
              </div>

              {isActive && (
                <div className="animate-pulse text-cyber-accent">
                  <Play size={12} fill="currentColor" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};