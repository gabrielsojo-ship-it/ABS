import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ChatMessage } from "../types";

// Initialize client
// Note: We create a new instance per call in some complex apps, but a singleton is fine here 
// provided the key doesn't change during session.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Chat with Gemini 3 Pro Preview
 */
export const sendChatMessage = async (
  history: ChatMessage[],
  newMessage: string,
  contextData: string
): Promise<string> => {
  try {
    const systemInstruction = `You are an expert HR assistant named "Personal Manager AI". 
    You are helpful, professional, and concise.
    You have access to the following current anonymous team context data: ${contextData}.
    Answer questions about HR best practices, data analysis of the provided context, or general assistance.`;

    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: systemInstruction,
      },
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }))
    });

    const result: GenerateContentResponse = await chat.sendMessage({ message: newMessage });
    return result.text || "I couldn't generate a response.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "Error connecting to AI service. Please check your API Key.";
  }
};

/**
 * Analyze Data for Insights
 */
export const analyzeData = async (dataContext: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analyze this HR data and provide 3 brief, high-impact strategic insights regarding turnover risk, shift balance, or seniority distribution. Use bullet points. Data: ${dataContext}`,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Analysis Error:", error);
    return "Could not analyze data at this time.";
  }
};

/**
 * Generate Image using Gemini 3 Pro Image Preview
 */
export const generateImage = async (
  prompt: string, 
  resolution: '1K' | '2K' | '4K'
): Promise<string | null> => {
  try {
    // gemini-3-pro-image-preview supports '1K', '2K', '4K' in imageSize
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          imageSize: resolution,
          aspectRatio: "1:1" // Default square for this app
        }
      }
    });

    // Extract image
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw new Error("Failed to generate image.");
  }
};