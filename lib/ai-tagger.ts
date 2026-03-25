import { CopilotClient } from '@github/copilot-sdk';

let client: CopilotClient | null = null;

async function getClient(): Promise<CopilotClient> {
  if (!client) {
    client = new CopilotClient();
    await client.start();
  }
  return client;
}

export interface TagSuggestions {
  genres: string[];
  moods: string[];
  phases: string[];
}

/**
 * Get AI-powered tag suggestions for a song based on its metadata.
 * Uses the Copilot SDK as a lightweight helper — simple prompt, JSON response.
 */
export async function suggestTags(song: {
  title?: string;
  artist?: string;
  bpm?: number;
  key?: string;
  energyLevel?: number;
  existingGenres?: string[];
  existingMoods?: string[];
  existingPhases?: string[];
  knownTags?: { genres: string[]; moods: string[]; phases: string[] };
}): Promise<TagSuggestions> {
  const cl = await getClient();

  const existingInfo = [
    song.existingGenres?.length ? `Current genres: ${song.existingGenres.join(', ')}` : '',
    song.existingMoods?.length ? `Current moods: ${song.existingMoods.join(', ')}` : '',
    song.existingPhases?.length ? `Current phases: ${song.existingPhases.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const vocabularyHint = song.knownTags ? [
    song.knownTags.genres.length ? `Available genres in library: ${song.knownTags.genres.join(', ')}` : '',
    song.knownTags.moods.length ? `Available moods in library: ${song.knownTags.moods.join(', ')}` : '',
    song.knownTags.phases.length ? `Available phases in library: ${song.knownTags.phases.join(', ')}` : '',
  ].filter(Boolean).join('\n') : '';

  const prompt = `You are a DJ music tagger. Given a song's metadata, suggest tags.
Return ONLY a JSON object with three arrays: genres, moods, phases.
Each array should have 2-4 suggestions. Prefer tags from the available vocabulary when they fit.
Do NOT repeat tags the song already has.

Song metadata:
- Title: ${song.title || 'Unknown'}
- Artist: ${song.artist || 'Unknown'}
${song.bpm ? `- BPM: ${song.bpm}` : ''}
${song.key ? `- Key: ${song.key}` : ''}
${song.energyLevel ? `- Energy: ${song.energyLevel}/10` : ''}
${existingInfo ? `\n${existingInfo}` : ''}
${vocabularyHint ? `\n${vocabularyHint}` : ''}

Respond with ONLY the JSON object, no markdown fences, no explanation.`;

  // Deny all tool permissions — we only want text completion
  const session = await cl.createSession({
    model: 'gpt-4.1',
    reasoningEffort: 'low',
    onPermissionRequest: async () => 'deny' as any,
    systemMessage: {
      content: 'You are a concise JSON-only responder for DJ music tagging. No tools needed.',
    },
  });

  try {
    const response = await session.sendAndWait({ prompt }, 15000);
    const text = response?.data?.content || '';

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    return {
      genres: Array.isArray(parsed.genres) ? parsed.genres.map((s: string) => s.toLowerCase().trim()).slice(0, 5) : [],
      moods: Array.isArray(parsed.moods) ? parsed.moods.map((s: string) => s.toLowerCase().trim()).slice(0, 5) : [],
      phases: Array.isArray(parsed.phases) ? parsed.phases.map((s: string) => s.toLowerCase().trim()).slice(0, 5) : [],
    };
  } catch (error) {
    console.error('[AI Tagger] Failed to get suggestions:', error);
    return { genres: [], moods: [], phases: [] };
  } finally {
    await session.disconnect();
  }
}

/** Gracefully stop the client (call on server shutdown) */
export async function stopAITagger(): Promise<void> {
  if (client) {
    await client.stop();
    client = null;
  }
}
