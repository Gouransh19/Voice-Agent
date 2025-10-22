import { GoogleGenAI, Chat, Modality, LiveConnectRequest } from "@google/genai";
import { GroundingSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chat: Chat | null = null;

function getChat(): Chat {
  if (!chat) {
    chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
  }
  return chat;
}

export async function sendMessageStream(
  message: string,
  onChunk: (chunk: string) => void,
  onSources: (sources: GroundingSource[]) => void,
): Promise<void> {
  const chatInstance = getChat();
  const stream = await chatInstance.sendMessageStream({ message });

  let fullResponseText = "";
  
  for await (const chunk of stream) {
    const chunkText = chunk.text;
    if (chunkText) {
      fullResponseText += chunkText;
      onChunk(fullResponseText);
    }
    
    if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        const sources: GroundingSource[] = chunk.candidates[0].groundingMetadata.groundingChunks
            .map((c: any) => c.web)
            .filter((web: any) => web && web.uri && web.title)
            .map((web: any) => ({ uri: web.uri, title: web.title }));
        if (sources.length > 0) {
            onSources(sources);
        }
    }
  }
}

// The LiveConnectRequest['callbacks'] provides typing for the callbacks object
export function connectLiveAgent(callbacks: LiveConnectRequest['callbacks']) {
    return ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            outputAudioTranscription: {},
            inputAudioTranscription: {},
        }
    });
}
