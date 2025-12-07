
import React, { useState, useEffect } from 'react';
import { AnalysisResult, FeedbackDetails, GamePhase, MacroStep } from '../types';
import { ShieldAlert, Crosshair, TrendingUp, CheckCircle2, ThumbsUp, ThumbsDown, Loader2, PlayCircle, LogIn, AlertOctagon, MonitorPlay, ScanLine, BrainCircuit, RefreshCw, FastForward, Type } from 'lucide-react';
import { MacroView } from './MacroView';

interface AnalysisViewProps {
  result: AnalysisResult | null;
  isLoading: boolean;
  onFeedback: (feedback: FeedbackDetails) => void;
  hasGivenFeedback: boolean;
  onPreviewStep?: (step: MacroStep) => Promise<void>;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, isLoading, onFeedback, hasGivenFeedback, onPreviewStep }) => {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [correctionType, setCorrectionType] = useState<FeedbackDetails['correctionType']>('WRONG_ACTION');
  const [suggestedAction, setSuggestedAction] = useState('');

  // Reset local state only when result ID changes (new analysis)
  useEffect(() => {
    if (result) {
        setShowFeedbackForm(false);
        setCorrectionType('WRONG_ACTION');
        setSuggestedAction('');
    }
  }, [result?.timestamp]); // Use timestamp or ID to detect actual new data

  // Initial Loading State (Only if no data exists yet)
  if (isLoading && !result) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-cyber-accent">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 border-4 border-cyber-700 rounded-full"></div>
          <div className="absolute inset-0 border-t-4 border-cyber-accent rounded-full animate-spin"></div>
          <div className="absolute inset-4 bg-cyber-800 rounded-full flex items-center justify-center animate-pulse">
            <Crosshair className="w-8 h-8" />
          </div>
        </div>
        <h2 className="text-xl font-mono tracking-widest uppercase animate-pulse">INITIALIZING...</h2>
        <div className="text-xs font-mono text-gray-500 mt-2">ESTABLISHING TEMPORAL UPLINK</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 opacity-50 p-6">
        <MonitorPlay size={48} className="mb-4" />
        <p className="font-mono text-center text-sm">WAITING FOR GAME SIGNAL</p>
      </div>
    );
  }

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-cyber-danger border-cyber-danger shadow-[0_0_15px_rgba(255,0,60,0.5)]';
      case 'HIGH': return 'text-orange-500 border-orange-500';
      case 'MEDIUM': return 'text-yellow-400 border-yellow-400';
      default: return 'text-green-400 border-green-400';
    }
  };

  const getPhaseIcon = (phase: GamePhase) => {
    switch (phase) {
      case 'LOADING': return <Loader2 className="animate-spin text-cyber-accent" />;
      case 'CINEMATIC': return <PlayCircle className="text-purple-400" />;
      case 'LOGIN': 
      case 'BOOT': return <LogIn className="text-yellow-400" />;
      case 'ERROR': return <AlertOctagon className="text-red-500" />;
      default: return <Crosshair className="text-green-400" />;
    }
  };

  const handleSubmitNegativeFeedback = () => {
    onFeedback({ isAccurate: false, correctionType, suggestedAction });
    setShowFeedbackForm(false);
  };

  const isPassivePhase = ['LOADING', 'CINEMATIC', 'BOOT', 'ERROR'].includes(result.phase);

  return (
    <div className="w-full space-y-4 animate-fadeIn pb-20 relative">
      
      {/* Loading Overlay (Live Refresh Indicator) */}
      {isLoading && (
          <div className="absolute top-0 right-0 z-50">
              <div className="flex items-center gap-2 px-2 py-1 bg-cyber-900/90 border border-cyber-accent/50 rounded-full text-[10px] text-cyber-accent shadow-lg backdrop-blur">
                  <RefreshCw size={10} className="animate-spin" />
                  <span className="font-mono">TEMPORAL SCAN</span>
              </div>
          </div>
      )}

      {/* Phase Indicator */}
      <div className="flex items-center gap-3 p-3 bg-cyber-800 border-l-4 border-cyber-500 rounded-r shadow-md">
         {getPhaseIcon(result.phase)}
         <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-mono uppercase">Current Status</span>
            <span className="font-bold text-white tracking-wider">{result.phase}</span>
         </div>
      </div>

      {/* Header Stats (Only show in Gameplay/Menu) */}
      {!isPassivePhase && (
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 border rounded bg-cyber-900/50 flex flex-col items-center justify-center transition-colors duration-300 ${getThreatColor(result.threatLevel)}`}>
            <ShieldAlert className="mb-1 w-5 h-5" />
            <span className="text-xs font-mono uppercase opacity-70">Threat</span>
            <span className="font-bold tracking-wider">{result.threatLevel}</span>
          </div>
          <div className="p-3 border border-cyber-500 text-cyber-accent rounded bg-cyber-900/50 flex flex-col items-center justify-center shadow-[0_0_10px_rgba(99,102,241,0.2)]">
            <TrendingUp className="mb-1 w-5 h-5" />
            <span className="text-xs font-mono uppercase opacity-70">Success %</span>
            <span className="font-bold tracking-wider">{result.estimatedWinRate}%</span>
          </div>
        </div>
      )}

      {/* Main Strategy */}
      <div className="bg-cyber-800/80 border-l-4 border-cyber-accent p-4 rounded-r-lg shadow-lg backdrop-blur-sm">
        <h3 className="text-lg font-bold text-white mb-1">{result.title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed">{result.summary}</p>
      </div>

      {/* NEW: Learned Intelligence Display */}
      {result.newlyDiscoveredRules && result.newlyDiscoveredRules.length > 0 && (
        <div className="bg-purple-900/20 border border-purple-500/50 p-3 rounded animate-pulse-fast">
          <div className="flex items-center gap-2 mb-2 text-purple-400">
             <BrainCircuit size={16} />
             <span className="text-xs font-bold uppercase tracking-wider">New Intelligence Acquired</span>
          </div>
          <ul className="list-disc list-inside space-y-1">
             {result.newlyDiscoveredRules.map((rule, i) => (
                <li key={i} className="text-xs text-gray-200">{rule}</li>
             ))}
          </ul>
          <div className="mt-2 text-[9px] text-purple-400/70 font-mono text-right">DATABASE UPDATED</div>
        </div>
      )}

      {/* NEW: Motion Analysis Log */}
      {result.motionVectors && result.motionVectors.length > 0 && (
         <div className="bg-red-900/10 border border-red-800/50 p-3 rounded">
            <div className="flex items-center gap-2 mb-2 text-red-400">
                <FastForward size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">MOTION DETECTED</span>
            </div>
            <div className="space-y-1">
               {result.motionVectors.map((mv, i) => (
                   <div key={i} className="flex justify-between text-[10px] text-gray-300 border-b border-red-900/30 pb-1">
                      <span>{mv.element}</span>
                      <span className="text-red-300 font-mono">{mv.velocity}</span>
                   </div>
               ))}
            </div>
         </div>
      )}

       {/* Vision Log (Debug) */}
       {result.detectedElements && result.detectedElements.length > 0 && (
        <div className="bg-black/40 border border-cyber-800 rounded p-2">
          <div className="flex items-center gap-2 mb-2">
            <ScanLine size={12} className="text-cyber-500" />
            <span className="text-[10px] font-mono text-cyber-500 uppercase">Vision Log</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {result.detectedElements.map((el, i) => (
              <span key={i} className="text-[10px] bg-cyber-900 text-gray-400 px-1.5 py-0.5 rounded border border-cyber-800/50">
                {el}
              </span>
            ))}
          </div>
        </div>
      )}

       {/* DEEP OCR LOG */}
       {result.extractedText && result.extractedText.length > 0 && (
        <div className="bg-black/40 border border-cyber-800 rounded p-2">
          <div className="flex items-center gap-2 mb-2">
            <Type size={12} className="text-cyber-500" />
            <span className="text-[10px] font-mono text-cyber-500 uppercase">DEEP OCR DATA</span>
          </div>
          <div className="max-h-24 overflow-y-auto custom-scrollbar">
             <p className="text-[9px] text-gray-500 font-mono whitespace-pre-wrap leading-tight">
               {result.extractedText.join(" | ")}
             </p>
          </div>
        </div>
      )}

      {/* Automated Macro Sequence */}
      <MacroView 
          sequence={result.macroSequence || []} 
          isPlaying={true} // Default to true, but MacroView manages internal pause/play
          onPreviewStep={onPreviewStep}
      />

      {/* Feedback Loop */}
      <div className="pt-4 border-t border-cyber-800 mt-4">
         <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-gray-500 uppercase">RLHF FEEDBACK</span>
         </div>
         
         {hasGivenFeedback ? (
            <div className="bg-green-900/20 border border-green-800 p-2 rounded flex items-center justify-center gap-2 text-green-400 text-sm">
               <CheckCircle2 size={16} /> LOGGED
            </div>
         ) : showFeedbackForm ? (
            <div className="bg-red-900/10 border border-red-900/30 rounded p-3 animate-fadeIn">
              <select 
                value={correctionType}
                onChange={(e) => setCorrectionType(e.target.value as any)}
                className="w-full bg-black/50 border border-red-800/50 rounded px-2 py-1 text-xs text-white mb-2"
              >
                <option value="WRONG_ACTION">Wrong Action</option>
                <option value="BAD_TARGET">Bad Coordinates</option>
                <option value="MISSED_THREAT">Missed Threat</option>
              </select>
              <textarea 
                value={suggestedAction}
                onChange={(e) => setSuggestedAction(e.target.value)}
                placeholder="What was the correct move?"
                className="w-full bg-black/50 border border-red-800/50 rounded px-2 py-1 text-xs text-gray-300 mb-2 h-16"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowFeedbackForm(false)} className="flex-1 py-1 text-gray-400 text-xs">Cancel</button>
                <button onClick={handleSubmitNegativeFeedback} className="flex-1 py-1 bg-red-900/50 border border-red-700 text-red-200 text-xs rounded">Submit</button>
              </div>
            </div>
         ) : (
           <div className="flex gap-2">
             <button onClick={() => onFeedback({ isAccurate: true })} className="flex-1 py-2 bg-cyber-800 hover:bg-green-900/30 border border-cyber-700 hover:border-green-700 rounded transition-colors text-gray-400 hover:text-green-400 flex items-center justify-center gap-2">
               <ThumbsUp size={16} /> Accurate
             </button>
             <button onClick={() => setShowFeedbackForm(true)} className="flex-1 py-2 bg-cyber-800 hover:bg-red-900/30 border border-cyber-700 hover:border-red-700 rounded transition-colors text-gray-400 hover:text-red-400 flex items-center justify-center gap-2">
               <ThumbsDown size={16} /> Failed
             </button>
           </div>
         )}
      </div>
    </div>
  );
};
