
import { GameProfile, TrainingLog, GameGenre, ErrorLog } from "../types";

const PROFILES_KEY = 'nexus_game_profiles';
const LOGS_KEY = 'nexus_training_logs';
const ERRORS_KEY = 'nexus_system_errors';

// --- PRELOADED DATABASE (Top Android Games) ---
const SYSTEM_PROFILES: GameProfile[] = [
  {
    id: 'universal_auto',
    name: '⚡ UNIVERSAL / AUTO-DETECT',
    genre: GameGenre.UNKNOWN,
    notes: 'AI will automatically identify the game type and objectives.'
  },
  {
    id: 'fps_royale',
    name: 'PUBG / Free Fire / COD',
    genre: GameGenre.ACTION,
    notes: 'Focus on recoil control, enemy spotting in distance, and safe zone movement. Prioritize headshots and cover.'
  },
  {
    id: 'moba_standard',
    name: 'LoL: Wild Rift / MLBB',
    genre: GameGenre.MOBA,
    notes: 'Prioritize last-hitting minions, tower defense, and ganking. Monitor mini-map for enemy rotation.'
  },
  {
    id: 'strategy_clash',
    name: 'Clash of Clans / Royale',
    genre: GameGenre.STRATEGY,
    notes: 'Analyze elixir/resource trade. Optimize troop deployment placement (kiting). Counter enemy unit types.'
  },
  {
    id: 'puzzle_match3',
    name: 'Candy Crush / Royal Match',
    genre: GameGenre.PUZZLE,
    notes: 'Look for matches of 4 or 5. Prioritize clearing obstacles (jelly, boxes) and bottom-row matches to cause cascades.'
  },
  {
    id: 'rpg_gacha',
    name: 'Genshin Impact / Honkai',
    genre: GameGenre.RPG,
    notes: 'Optimize elemental reactions. Manage stamina for dodging. Focus on DPS rotation.'
  },
  {
    id: 'runner_subway',
    name: 'Subway Surfers / Temple Run',
    genre: GameGenre.ACTION,
    notes: 'Look ahead. Swipe early for corners. Prioritize coins only if safe.'
  },
  {
    id: 'social_impostor',
    name: 'Among Us / Roblox',
    genre: GameGenre.UNKNOWN,
    notes: 'Analyze chat patterns if visible. Memorize pathing. Detect unusual player movement.'
  },
  {
    id: 'card_battle',
    name: 'Marvel Snap / Hearthstone',
    genre: GameGenre.STRATEGY,
    notes: 'Calculate mana curve. Predict enemy turn. Value board control over face damage early.'
  },
  {
    id: 'sim_builder',
    name: 'SimCity / Township',
    genre: GameGenre.STRATEGY,
    notes: 'Optimize production queues. Minimize downtime. Prioritize high-value orders.'
  }
];

// --- Profils Management ---

export const getProfiles = (): GameProfile[] => {
  const stored = localStorage.getItem(PROFILES_KEY);
  const userProfiles = stored ? JSON.parse(stored) : [];
  
  // Merge system profiles with user profiles, ensuring no ID collisions if user saved custom ones
  // We place System profiles first for easy access
  return [...SYSTEM_PROFILES, ...userProfiles.filter((up: GameProfile) => !SYSTEM_PROFILES.find(sp => sp.id === up.id))];
};

export const saveProfile = (profile: GameProfile) => {
  const stored = localStorage.getItem(PROFILES_KEY);
  const userProfiles = stored ? JSON.parse(stored) : [];
  
  const existingIndex = userProfiles.findIndex((p: GameProfile) => p.id === profile.id);
  
  if (existingIndex >= 0) {
    userProfiles[existingIndex] = profile;
  } else {
    userProfiles.push(profile);
  }
  
  localStorage.setItem(PROFILES_KEY, JSON.stringify(userProfiles));
};

export const deleteProfile = (id: string) => {
  // Cannot delete system profiles
  if (SYSTEM_PROFILES.find(p => p.id === id)) return;

  const stored = localStorage.getItem(PROFILES_KEY);
  if (!stored) return;

  const userProfiles = JSON.parse(stored).filter((p: GameProfile) => p.id !== id);
  localStorage.setItem(PROFILES_KEY, JSON.stringify(userProfiles));
};

// --- Data Collection (Black Box) ---

export const saveLog = (log: TrainingLog) => {
  const logsString = localStorage.getItem(LOGS_KEY);
  const logs: TrainingLog[] = logsString ? JSON.parse(logsString) : [];
  
  // Keep only last 50 logs to prevent localStorage overflow in browser
  if (logs.length > 50) logs.shift();
  
  logs.push(log);
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
};

export const updateLogFeedback = (logId: string, feedback: TrainingLog['userFeedback']) => {
  const logsString = localStorage.getItem(LOGS_KEY);
  if (!logsString) return;
  
  const logs: TrainingLog[] = JSON.parse(logsString);
  const index = logs.findIndex(l => l.id === logId);
  
  if (index !== -1) {
    logs[index].userFeedback = feedback;
    localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  }
};

export const exportTrainingData = () => {
  const logs = localStorage.getItem(LOGS_KEY);
  if (!logs) return;
  
  const blob = new Blob([logs], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nexus_training_data_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const getLogStats = () => {
  const logsString = localStorage.getItem(LOGS_KEY);
  const logs: TrainingLog[] = logsString ? JSON.parse(logsString) : [];
  
  const total = logs.length;
  const accurate = logs.filter(l => l.userFeedback?.isAccurate).length;
  const errors = logs.filter(l => l.userFeedback && !l.userFeedback.isAccurate).length;
  
  return { total, accurate, errors };
};

// --- System Error Logging ---

export const saveErrorLog = (error: ErrorLog) => {
  const logsString = localStorage.getItem(ERRORS_KEY);
  const logs: ErrorLog[] = logsString ? JSON.parse(logsString) : [];
  
  // Keep last 50 logs
  if (logs.length > 50) logs.shift();
  
  logs.push(error);
  localStorage.setItem(ERRORS_KEY, JSON.stringify(logs));
};

export const getSystemErrorCount = (): number => {
  const logsString = localStorage.getItem(ERRORS_KEY);
  return logsString ? JSON.parse(logsString).length : 0;
};

export const exportErrorLogs = () => {
  const logs = localStorage.getItem(ERRORS_KEY);
  if (!logs) return;
  
  const blob = new Blob([logs], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nexus_error_logs_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const clearErrorLogs = () => {
  localStorage.removeItem(ERRORS_KEY);
};
