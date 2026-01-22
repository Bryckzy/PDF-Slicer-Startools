
import { GoogleGenAI } from "@google/genai";

export const extractDocNumber = async (imageBase64: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `Você é um especialista em processamento de boletos bancários.
  Analise a imagem deste boleto e localize o campo "Num. do Documento", "Número do Documento" ou "Nº do Doc".
  
  Instruções:
  1. O campo geralmente está localizado no cabeçalho do boleto, próximo à "Data do Documento".
  2. O formato esperado é tipicamente de 5 a 10 dígitos seguidos de um hífen e um dígito (ex: 24277-4 ou 00012-3).
  3. Ignore o "Nosso Número" ou a "Linha Digitável". Eu quero apenas o número que identifica o documento interno.
  
  Responda APENAS com o número encontrado (ex: 24277-4). 
  Se não encontrar nada que se pareça com um número de documento nesse formato, responda exatamente: "NAO_ENCONTRADO".`;

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
        temperature: 0, // Determinístico
      }
    });

    const result = response.text?.trim() || "NAO_ENCONTRADO";
    return result;
  } catch (error) {
    console.error("Gemini OCR Error:", error);
    return "ERRO_IA";
  }
};
