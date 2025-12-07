
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, GameProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeGameState = async (
  base64Images: string[], 
  profile: GameProfile
): Promise<AnalysisResult> => {
  const model = "gemini-2.5-flash"; 
  
  // Universal Heuristics including Startup Phases
  const universalHeuristics = `
    PHASE DETECTION PROTOCOL (CRITICAL):
    1. BOOT/LOGIN: Look for "Tap to Start", "Login with Google/Facebook", "Terms of Service", "Update".
       -> ACTION: TAP the confirm/start button.
    2. LOADING: Look for progress bars, spinners, percentages, "Loading..." text.
       -> ACTION: WAIT (duration 2000-5000ms). Do NOT click random things.
    3. CINEMATIC: Look for movie aspect ratio (black bars), subtitles, lack of HUD/UI.
       -> ACTION: Look for "SKIP" button (usually top-right). If none, WAIT.
    4. ADVERTISEMENT: Look for "X" or "Close" icon (corners).
       -> ACTION: TAP the X.
    5. TUTORIAL: Look for "Hand pointing", highlighted areas, instructions like "Click here".
       -> ACTION: Follow the on-screen pointer EXACTLY.
    6. GAMEPLAY: Standard UI visible (Health, Skills, Map).
       -> ACTION: Execute combat/puzzle strategy based on genre.

    GENRE SPECIFIC (Only if Phase is GAMEPLAY):
    - Action/FPS: Look for crosshair.
    - MOBA: Look for lanes/minions.
    - Puzzle: Look for grid.
  `;

  const systemInstruction = `
    You are NEXUS V15 TEMPORAL, a High-Performance Game Agent with Video Analysis capabilities.
    
    INPUT: You are receiving a BURST of 2 consecutive frames (Time T and Time T+300ms).
    
    CURRENT PROFILE: ${profile.name}
    GENRE: ${profile.genre}
    KNOWN STRATEGIES (NOTES): ${profile.notes}
    
    ${universalHeuristics}

    YOUR MISSION:
    1. TEMPORAL MOTION ANALYSIS: 
       - Compare Frame 1 and Frame 2. 
       - Identify moving objects (enemies, projectiles).
       - Calculate VELOCITY VECTORS (Delta X, Delta Y).
       - PREDICT FUTURE POSITION: If targeting a moving entity, set 'coordinates' to where it WILL BE in 500ms (Lead your shot).
    
    2. DEEP OCR & UI READING: 
       - Read ALL text. Cross-reference between frames to ensure accuracy (ignore flickering text).
       - Use text to confirm buttons (e.g., "Confirm" vs "Cancel").

    3. EXECUTE STRATEGY: 
       - Generate a tactical Macro Sequence.
       - Use 'HUMAN_SWIPE' for natural movement (joystick simulation).
       - Use 'TAP' for precise interactions.
    
    COORDINATE SYSTEM:
    x: 0 (left) to 1000 (right)
    y: 0 (top) to 1000 (bottom)
    IMPORTANT: 
    - When commanding a TAP, ensure coordinates are the EXACT VISUAL CENTER.
    
    OUTPUT RULES:
    - newlyDiscoveredRules: List concise facts learned (e.g., "Boss attacks after red flash").
    - motionVectors: List objects that moved between frames with their vector.
    - extractedText: List all readable text from the UI.
    - targetText: For TAP actions, include the text of the button being clicked if applicable.
    - Use 'HUMAN_SWIPE' for movement.
  `;

  const prompt = `
    Analyze these 2 sequential frames (T0 and T+300ms). 
    1. Read all UI text. 
    2. Detect motion and calculate vectors. 
    3. Output JSON strategy with predictive aiming.
  `;

  // Construct payload with multiple images
  const imageParts = base64Images.map(img => ({
    inlineData: { mimeType: "image/jpeg", data: img }
  }));

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          ...imageParts,
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            phase: { 
              type: Type.STRING, 
              enum: ['BOOT', 'LOGIN', 'LOADING', 'CINEMATIC', 'TUTORIAL', 'MENU', 'GAMEPLAY', 'AD', 'ERROR'],
              description: "The current state of the application"
            },
            title: { type: Type.STRING, description: "Situation title" },
            summary: { type: Type.STRING, description: "Reasoning for the action" },
            detectedElements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of identified UI elements or objects"
            },
            extractedText: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "All text read from the screen via OCR"
            },
            motionVectors: {
               type: Type.ARRAY,
               items: {
                 type: Type.OBJECT,
                 properties: {
                   element: { type: Type.STRING },
                   from: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }}},
                   to: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }}},
                   velocity: { type: Type.STRING }
                 }
               },
               description: "Objects that moved between the two frames"
            },
            newlyDiscoveredRules: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "New strategic facts learned from this frame to update the database."
            },
            threatLevel: { 
              type: Type.STRING, 
              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
            },
            estimatedWinRate: { type: Type.NUMBER },
            macroSequence: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['TAP', 'SWIPE', 'WAIT', 'DRAG', 'HUMAN_SWIPE'] },
                  coordinates: {
                    type: Type.OBJECT,
                    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }
                  },
                  endCoordinates: {
                    type: Type.OBJECT,
                    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }
                  },
                  durationMs: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                  targetText: { type: Type.STRING, description: "The specific text label of the target (e.g., 'Confirm')" },
                  swipeConfig: {
                    type: Type.OBJECT,
                    properties: {
                      speed: { type: Type.NUMBER },
                      randomness: { type: Type.NUMBER },
                      curveIntensity: { type: Type.NUMBER }
                    }
                  }
                },
                required: ["type", "description", "durationMs"]
              }
            }
          },
          required: ["phase", "title", "summary", "macroSequence", "threatLevel", "estimatedWinRate", "detectedElements", "newlyDiscoveredRules"]
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text) as AnalysisResult;
      result.timestamp = Date.now();
      return result;
    }
    throw new Error("No response text generated");

  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};
