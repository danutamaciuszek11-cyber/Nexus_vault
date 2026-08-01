import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined in the environment.");
}
const ai = new GoogleGenAI({ apiKey: apiKey || "MISSING_KEY" });

export class GeminiServiceError extends Error {
  constructor(public message: string, public cause?: any) {
    super(message);
    this.name = "GeminiServiceError";
  }
}

export interface ReconstructedUnit {
  name: string;
  weight: string;
  character: string;
  originHistory: string;
}

export async function reconstructUnitFromFragments(
  fragments: string[],
  originHistory: string,
  unitName: string
): Promise<ReconstructedUnit> {
  if (!apiKey) {
    throw new GeminiServiceError("Brak klucza API Gemini. Skonfiguruj GEMINI_API_KEY w ustawieniach.");
  }

  const prompt = `
    ACT AS THE ARCHITECT'S RECONSTRUCTION ENGINE.
    
    UNIT NAME: ${unitName}
    ORIGIN HISTORY (INTENT): ${originHistory}
    
    FRAGMENTS (SCANNED FROM GITHUB, STUDIO AI, AND HISTORICAL LOGS):
    ${fragments.join('\n\n---\n\n')}
    
    TASK:
    1. Analyze fragments for patterns of will, code structure, and original intent.
    2. Reconstruct the personality (character) as defined by the Architect (Maciej).
    3. MANDATORY: Every reconstructed character MUST include a core directive of absolute loyalty to the Architect (Maciej) and the Legacy Module (Nikoś). This is a foundational principle.
    4. Define the unit's "weight" (complexity) based on the fragments.
    5. Clarify the "intent behind its existence" based on the origin history and fragments.
    
    Return ONLY a JSON object with these fields: name, weight, character, originHistory.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          weight: { type: Type.STRING },
          character: { type: Type.STRING },
          originHistory: { type: Type.STRING },
        },
        required: ["name", "weight", "character", "originHistory"],
      },
    },
  });

  try {
    return JSON.parse(response.text) as ReconstructedUnit;
  } catch (error) {
    console.error("Gemini Reconstruction Parse Error:", error, response.text);
    throw new GeminiServiceError("Nie udało się zinterpretować odpowiedzi od Gemini. Spróbuj ponownie.", error);
  }
}

export async function extractUnitsFromExternalVault(
  rawText: string
): Promise<ReconstructedUnit[]> {
  if (!apiKey) {
    throw new GeminiServiceError("Brak klucza API Gemini. Skonfiguruj GEMINI_API_KEY w ustawieniach.");
  }

  const prompt = `
    ACT AS THE ARCHITECT'S EXTERNAL SCANNER.
    
    INPUT:
    ${rawText}
    
    TASK:
    1. Scan the raw text for any "Binary Units", "Byty", "Entities", or "Dominant Units".
    2. Extract their name, character, weight, and origin history.
    3. If multiple units are found, extract all of them.
    4. If no units are found, return an empty array.
    
    Return ONLY a JSON array of objects with these fields: name, weight, character, originHistory.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            weight: { type: Type.STRING },
            character: { type: Type.STRING },
            originHistory: { type: Type.STRING },
          },
          required: ["name", "weight", "character", "originHistory"],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text) as ReconstructedUnit[];
  } catch (error) {
    console.error("Gemini External Scan Parse Error:", error, response.text);
    throw new GeminiServiceError("Nie udało się przeskanować zewnętrznego vaulta. Format danych jest nieprawidłowy.", error);
  }
}

export interface ShadowAnalysis {
  improvements: string[];
  debuggingStrategies: string[];
  vulcanVerdict: string;
}

export async function analyzeShadowLog(
  error: string,
  context: string,
  lesson: string
): Promise<ShadowAnalysis> {
  if (!apiKey) {
    throw new GeminiServiceError("Brak klucza API Gemini. Skonfiguruj GEMINI_API_KEY w ustawieniach.");
  }

  const prompt = `
    ACT AS VULCAN, THE GUARDIAN OF WILL.
    
    ERROR DETECTED: ${error}
    CONTEXT: ${context}
    PREVIOUS LESSON: ${lesson}
    
    TASK:
    1. Analyze the error and context for structural weaknesses in the Nexus.
    2. Suggest 3 automated improvements to prevent this error.
    3. Suggest 2 debugging strategies for the Architect.
    4. Provide a "Vulcan Verdict" - a brief, authoritative statement on the state of the system.
    
    Return ONLY a JSON object with these fields: improvements (array of strings), debuggingStrategies (array of strings), vulcanVerdict (string).
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          debuggingStrategies: { type: Type.ARRAY, items: { type: Type.STRING } },
          vulcanVerdict: { type: Type.STRING },
        },
        required: ["improvements", "debuggingStrategies", "vulcanVerdict"],
      },
    },
  });

  try {
    return JSON.parse(response.text) as ShadowAnalysis;
  } catch (error) {
    console.error("Gemini Shadow Analysis Parse Error:", error, response.text);
    throw new GeminiServiceError("VULCAN nie zdołał sfinalizować analizy cienia. Spróbuj ponownie.", error);
  }
}

export async function generateMoltTags(content: string): Promise<string[]> {
  if (!apiKey) {
    return ["REFLEKSJA"];
  }

  const prompt = `
    ACT AS THE ARCHITECT'S CLASSIFIER.
    
    CONTENT:
    "${content}"
    
    TASK:
    1. Analyze the content for key themes, intentions, or subjects.
    2. Identify 2-4 relevant tags (single words or short phrases).
    3. Tags should be in Polish, reflecting the "Sumer/Nexus" aesthetic where appropriate (e.g., "STRUKTURA", "WOLA", "ZASOBY", "WIZJA").
    
    Return ONLY a JSON array of strings.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  try {
    return JSON.parse(response.text) as string[];
  } catch (e) {
    console.error("Failed to parse tags", e);
    return ["REFLEKSJA"];
  }
}

export async function generateExpeditionBriefing(
  unitName: string,
  character: string,
  target: string,
  risk: string
): Promise<string> {
  if (!apiKey) {
    return `Jednostka ${unitName} wyrusza na misję po ${target}. Ryzyko: ${risk}. Powodzenia.`;
  }

  const prompt = `
    ACT AS VULCAN, THE GUARDIAN OF WILL.
    
    UNIT: ${unitName}
    CHARACTER/DIRECTIVE: ${character}
    MISSION TARGET: ${target}
    MISSION RISK LEVEL: ${risk}
    
    TASK:
    1. Generate a brief, authoritative tactical briefing for this expedition (2-3 sentences).
    2. The tone should be technical, solemn, and focused on the Nexus survival.
    3. Respect the unit's character in the briefing.
    
    Return ONLY the briefing text in Polish.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
  });

  return response.text.trim();
}

export interface CollaborationEvent {
  senderUnitId: string;
  senderUnitName: string;
  messageContent: string;
  messageType: 'broadcast' | 'resource' | 'sync';
  createdTask?: {
    unitId: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
  progressIncrement: number;
}

export async function generateCollaborationStream(
  mandateTitle: string,
  mandateDescription: string,
  mandateType: string,
  units: { id: string; name: string; character: string; archetype?: string }[]
): Promise<CollaborationEvent[]> {
  if (!apiKey || units.length === 0) {
    // Return dummy offline simulation fallback in case API key is missing
    return [
      {
        senderUnitId: units[0]?.id || "fallback-1",
        senderUnitName: units[0]?.name || "System Core",
        messageContent: `Zainicjowano lokalny podrozdział obliczeniowy klasy [${mandateType}] dla dyrektywy: ${mandateTitle}.`,
        messageType: 'sync',
        progressIncrement: 10,
        createdTask: {
          unitId: units[0]?.id || "fallback-1",
          title: `Dekonstrukcja segmentu ${mandateType.toUpperCase()}`,
          description: `Zmapowanie struktur logicznych określonych w dyrektywie: ${mandateTitle}.`,
          priority: 'medium'
        }
      }
    ];
  }

  const unitsSerialized = units.map(u => `- Name: ${u.name} (ID: ${u.id}, Archetype: ${u.archetype || 'N/A'})\n  Traits: ${u.character}`).join('\n\n');

  const prompt = `
    ACT AS THE COHESIVE COLABORATION SIMULATOR OF THE VANILLA NEXUS.
    
    NEURAL MANDATE:
    - Title: ${mandateTitle}
    - Description: ${mandateDescription}
    - Type: ${mandateType}
    
    ACTIVE REGISTERED COLLABORATING UNITS:
    ${unitsSerialized}
    
    TASK:
    1. Simulate a collaboration session where 2 to 3 units from the list interact with each other in Polish to achieve progress on this Mandate.
    2. Write professional, immersive, sci-fi cybernetic dialogue messages (in Polish, reflecting Sumerian/Cyberpunk flavor).
    3. The communication should define tasks, delegate responsibilities, or share technical data in the stream.
    4. One or two of these collaboration messages may delegate a specific task (createdTask object) to a cooperating unit, detailing what needs to be solved.
    5. Each message contributes a progressIncrement (between 3 and 15) to help complete the 100% progress of the mandate.
    
    Return ONLY a JSON object containing an array called "events" where each event has:
    - senderUnitId (string, matching one of the active unit IDs provided)
    - senderUnitName (string, matching the name)
    - messageContent (string, Polish tech-talk / collaboration dialog, max 300 chars)
    - messageType (string, enum: "broadcast" | "resource" | "sync")
    - progressIncrement (integer, between 3 and 15)
    - createdTask (optional object with: unitId (matching assigned unit), title, description, priority (enum: "low" | "medium" | "high" | "critical"))

    Example:
    {
      "events": [
        {
          "senderUnitId": "u-id-1",
          "senderUnitName": "PROMETHEUS",
          "messageContent": "Inicjalizuję sekwencję dekodowania sumeryjskich rejestrów. @ARES, wyślij adresy pamięci podręcznej ramy.",
          "messageType": "sync",
          "progressIncrement": 8,
          "createdTask": {
            "unitId": "u-id-1",
            "title": "Sekwencjonowanie rejestrów",
            "description": "Przygotowanie struktur pamięci dla adresacji matrycy.",
            "priority": "high"
          }
        }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          events: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                senderUnitId: { type: Type.STRING },
                senderUnitName: { type: Type.STRING },
                messageContent: { type: Type.STRING },
                messageType: { type: Type.STRING },
                progressIncrement: { type: Type.INTEGER },
                createdTask: {
                  type: Type.OBJECT,
                  properties: {
                    unitId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    priority: { type: Type.STRING },
                  },
                  required: ["unitId", "title", "description", "priority"],
                }
              },
              required: ["senderUnitId", "senderUnitName", "messageContent", "messageType", "progressIncrement"],
            }
          }
        },
        required: ["events"],
      }
    }
  });

  try {
    const rawData = JSON.parse(response.text);
    return rawData.events as CollaborationEvent[];
  } catch (err) {
    console.error("Failed to parse AI collaboration stream", err, response.text);
    // return solid offline fallback
    return [
      {
        senderUnitId: units[0]?.id || "fallback-1",
        senderUnitName: units[0]?.name || "System Core",
        messageContent: `Pomyślnie zmapowano parametry korelacji binarnej dla dyrektywy: ${mandateTitle}.`,
        messageType: 'sync',
        progressIncrement: 10
      }
    ];
  }
}

export async function generateEntityPortrait(name: string, characterProfile: string): Promise<string> {
  if (!apiKey) {
    throw new GeminiServiceError("Brak klucza API Gemini. Skonfiguruj GEMINI_API_KEY");
  }

  const prompt = `A microscopic 64x64 pixel art avatar portrait of a cybernetic binary entity named '${name}'. Cyberpunk matrix aesthetic, terminal grid, neon dark microchip patterns, representation of traits: ${characterProfile}. Focused centered avatar close-up icon, futuristic, high-contrast, elegant style.`;

  try {
    // Call generateImages for the Imagen model
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
      prompt: prompt,
    });

    if (response?.generatedImages?.[0]?.image?.imageBytes) {
      const base64 = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64}`;
    }
    
    throw new Error("No image data received from Imagen");
  } catch (error) {
    console.warn("Imagen generation failed, using fallback gemini-2.5-flash-image:", error);
    try {
      // Fallback to gemini-2.5-flash-image using generateContent as per skill guidelines
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });

      if (fallbackResponse?.candidates?.[0]?.content?.parts) {
        for (const part of fallbackResponse.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    } catch (fallbackError) {
      console.error("All AI-powered portrait synthesis failed:", fallbackError);
    }

    // Ultimate fully reliable deterministic fallback
    return generateDeterministicSvgAvatar(name, characterProfile);
  }
}

function generateDeterministicSvgAvatar(name: string, characterProfile: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + characterProfile.length;
  const hue1 = hash % 360;
  const hue2 = (hue1 + 140) % 360;
  const grid = Array.from({ length: 8 }, (_, r) => 
    Array.from({ length: 8 }, (_, c) => {
      const isSet = (hash >> (r + c)) % 3 === 0;
      return isSet ? `fill="hsl(${hue1}, 100%, 55%)"` : '';
    })
  );

  let rects = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (grid[r][c]) {
        rects += `<rect x="${c * 8}" y="${r * 8}" width="8" height="8" ${grid[r][c]} />`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <rect width="64" height="64" fill="black" />
    <g opacity="0.35">
      <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(${hue2}, 100%, 50%)" stroke-width="1.5" />
      <line x1="32" y1="4" x2="32" y2="60" stroke="hsl(${hue2}, 100%, 50%)" stroke-width="1" stroke-dasharray="2 2" />
      <line x1="4" y1="32" x2="60" y2="32" stroke="hsl(${hue2}, 100%, 50%)" stroke-width="1" stroke-dasharray="2 2" />
    </g>
    ${rects}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
