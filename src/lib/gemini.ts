import { GoogleGenerativeAI } from '@google/generative-ai';

// ... existing imports

export async function getAvailableModels(apiKey: string): Promise<string[]> {
    if (!apiKey) return [];
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API Error ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
        return data.models
            .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''));
    } catch (e) {
        console.error('Failed to list models', e);
        throw e; // Re-throw to be caught in UI
    }
}

export async function analyzePdf(file: File, apiKey: string, modelName: string = 'gemini-1.5-flash', promptText?: string): Promise<string> {
    if (!apiKey) throw new Error('API Key is missing');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const base64Data = await fileToGenerativePart(file);
    const prompt = promptText || "Analyze this PDF. Extract all text content and present it in a clean Markdown format. If there are tables or forms, represent them structurally.";

    try {
        const result = await model.generateContent([prompt, base64Data]);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        // Fallback Strategy
        // If the primary failed (e.g. 1.5-flash), try 1.5-pro, then gemini-pro
        // Handle 404 (Not Found) and 429 (Too Many Requests)
        if (error.message.includes('404') || error.message.includes('429')) {
            console.warn(`Model ${modelName} failed (404/429). Attempting fallbacks...`);

            const fallbackCandidates = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
            // Remove the model that just failed
            const candidates = fallbackCandidates.filter(m => m !== modelName);

            for (const candidate of candidates) {
                console.log(`Trying fallback: ${candidate}`);
                try {
                    const fallbackModel = genAI.getGenerativeModel({ model: candidate });
                    const result = await fallbackModel.generateContent([prompt, base64Data]);
                    const response = await result.response;
                    return response.text() + `\n\n(Note: Analysis performed using fallback model: ${candidate})`;
                } catch (e) {
                    console.warn(`Fallback ${candidate} failed.`);
                    // continue to next candidate
                }
            }
        }

        console.error('Gemini API Error:', error);

        if (error.message.includes('429')) {
            return `### ⚠️ 분석 실패: 사용량 제한 초과 (429 Error)

**구글 Gemini API의 무료 사용량(Free Tier)을 초과했습니다.**

**💡 해결 방법:**
1. ⏳ **잠시 기다리기**: 약 1분 정도 기다렸다가 다시 시도해 주세요. (무료 플랜은 분당 요청 횟수가 제한됩니다)
2. 💳 **유료로 제한 풀기**:
   [Google Cloud Console Billing](https://console.cloud.google.com/billing)에 접속하여 이 프로젝트에 **결제 계정**을 연결해 주세요.
   > **알림:** 결제 계정을 연결하면 **유료(Pay-as-you-go)** 요금제로 전환되며, 사용량에 따라 요금이 부과되지만 제한 없이 이용할 수 있습니다.

---
*(상세 에러 내용)*: ${error.message}`;
        }

        return `### 🚫 오류 발생
        
오류가 발생했습니다: ${error.message}
        
API 키 설정이나 모델 설정을 다시 확인해 주세요.`;
    }
}

async function fileToGenerativePart(file: File) {
    const base64EncodedDataPromise = new Promise((resolve) => {
        const reader = new FileReader();
        // @ts-ignore
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });

    return {
        inlineData: {
            // @ts-ignore
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
}
