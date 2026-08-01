export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export class OllamaServiceError extends Error {
  constructor(public message: string, public cause?: any) {
    super(message);
    this.name = "OllamaServiceError";
  }
}

export async function reconstructWithOllama(
  endpoint: string,
  model: string,
  fragments: string[]
): Promise<any> {
  const prompt = `
    Analyze the following code fragments and logs to reconstruct the identity of a "Binary Unit".
    Return ONLY a JSON object with these fields: name, weight, character, originHistory.
    
    Fragments:
    ${fragments.join('\n\n---\n\n')}
  `;

  try {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        format: 'json'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new OllamaServiceError(`Ollama API Error: ${response.status} ${response.statusText}`, errorText);
    }

    const data: OllamaResponse = await response.json();
    
    try {
      return JSON.parse(data.response);
    } catch (parseError) {
      console.error("Ollama JSON Parse Error:", parseError, data.response);
      throw new OllamaServiceError("Ollama zwróciła nieprawidłowy format danych. Spróbuj zmienić model lub parametry.", parseError);
    }
  } catch (error) {
    if (error instanceof OllamaServiceError) throw error;
    
    console.error("Ollama Connection Error:", error);
    throw new OllamaServiceError("Nie udało się połączyć z usługą Ollama. Sprawdź czy jest uruchomiona i czy adres URL jest poprawny.", error);
  }
}

export async function generateExpeditionBriefingWithOllama(
  endpoint: string,
  model: string,
  unitName: string,
  character: string,
  target: string,
  risk: string
): Promise<string> {
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

  try {
    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false
      }),
    });

    if (!response.ok) {
      return `[BŁĄD OLLAMA] Jednostka ${unitName} wyrusza na misję po ${target}. Ryzyko: ${risk}.`;
    }

    const data: OllamaResponse = await response.json();
    return data.response.trim();
  } catch (error) {
    return `[BŁĄD POŁĄCZENIA] Jednostka ${unitName} wyrusza na misję po ${target}. Ryzyko: ${risk}.`;
  }
}

export async function pingOllama(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
