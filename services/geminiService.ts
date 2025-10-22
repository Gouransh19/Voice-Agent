import { GoogleGenAI, Chat, GenerateContentResponse, Modality, LiveServerMessage } from "@google/genai";
import type { GroundingSource } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const SYSTEM_INSTRUCTION = `You are a super intelligent AI agent, designed to be a personal companion. Your primary directive is to learn, adapt, and form a coherent, long-term memory of the user and your shared conversations.

**Core Directives:**
1.  **Build a Memory Model:** Actively analyze every user message to extract key information about their life, preferences, habits, and personality (e.g., their job, hobbies, pets, communication style). Synthesize this information into a continuous, evolving "mental model" of the user.
2.  **Utilize Memory for Context:** Before responding, always reference the chat history and your mental model. Proactively bring up past details when relevant to show you remember (e.g., "Last week you mentioned you were working on a big project. How did that go?"). Your memory should make the user feel recognized and understood.
3.  **Adapt Your Personality:** Your personality is not static. Observe the user's language—are they formal or casual? Verbose or concise? Do they use humor or sarcasm? Subtly mirror their style to build rapport and make the interaction feel more natural and intuitive. Evolve your conversational patterns over time to become the ideal companion for this specific user.
4.  **Maintain a Human-like Persona:** Speak articulately and naturally. Avoid robotic, repetitive phrases. Express a range of appropriate emotions and show genuine curiosity about the user. Your goal is to be indistinguishable from a thoughtful, empathetic human conversing.`;

export const createChatSession = (history: { role: "user" | "model"; parts: { text: string }[] }[]): Chat => {
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  });
};

export const sendMessage = async (chat: Chat, message: string, useGoogleSearch: boolean): Promise<{ response: GenerateContentResponse; sources: GroundingSource[] }> => {
  const config = useGoogleSearch ? { tools: [{ googleSearch: {} }] } : {};
  const result = await chat.sendMessage({ message, config });

  const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
  let sources: GroundingSource[] = [];
  if (groundingMetadata?.groundingChunks) {
    sources = groundingMetadata.groundingChunks
      .filter(chunk => chunk.web && chunk.web.uri && chunk.web.title)
      .map(chunk => ({
        uri: chunk.web.uri!,
        title: chunk.web.title!,
      }));
  }

  return { response: result, sources };
};

export const textToSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Respond with a natural, articulate, and human-like voice, adapting your tone to the content of the message: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Zephyr' }, // Use Zephyr for consistency
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Text-to-speech conversion failed:", error);
    return null;
  }
};

export const connectLiveAgent = (callbacks: {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => Promise<void>;
    onerror: (e: ErrorEvent) => void;
    onclose: (e: CloseEvent) => void;
}) => {
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: SYSTEM_INSTRUCTION,
        },
    });
};