
import { GoogleGenAI, Type } from "@google/genai";

export const extractDocNumber = async (imageBase64: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Analise este boleto bancário e extraia APENAS o valor do campo "Número do Documento" ou "Nº do Documento". 
  O formato esperado é algo como 00000-0 (cinco dígitos, um hífen e um dígito verificador).
  Se houver vários números, procure especificamente pelo rótulo "Número do Documento".
  Responda apenas com o número encontrado. Se não encontrar, responda "NAO_ENCONTRADO".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        temperature: 0.1, // Low temperature for more deterministic results
      }
    });

    const result = response.text?.trim() || "NAO_ENCONTRADO";
    return result;
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    return "ERRO_IA";
  }
};
