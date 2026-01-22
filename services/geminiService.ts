
import { GoogleGenAI } from "@google/genai";

export const extractDocNumber = async (imageBase64: string): Promise<string> => {
  // Inicialização dentro da função para garantir captura da chave em tempo real (Vercel)
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "ERRO_SEM_CHAVE";

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Você é um robô de OCR especializado em boletos brasileiros (Layout Bradesco/Febraban).
  OBJETIVO: Localizar o número do campo "Num. do Documento" (Número do Documento).
  
  CARACTERÍSTICAS DO CAMPO:
  1. Ele geralmente está logo à direita da "Data do Documento".
  2. No boleto Bradesco, ele fica na parte superior esquerda do quadro de informações.
  3. O formato comum é um número curto com um dígito verificador após o hífen (exemplo: 24277-4).
  4. NÃO confunda com o "Nosso Número" (que é muito maior).
  5. NÃO confunda com o "Código do Beneficiário" ou "Agência".
  
  SAÍDA:
  - Responda APENAS o número encontrado (ex: 24277-4).
  - Se absolutamente não encontrar, responda: NAO_ENCONTRADO.
  - Não inclua explicações ou texto adicional.`;

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
        temperature: 0.1,
        topP: 1,
        topK: 1
      }
    });

    const result = response.text?.trim() || "NAO_ENCONTRADO";
    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "ERRO_IA";
  }
};
