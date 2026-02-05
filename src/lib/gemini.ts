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
    } catch (e: unknown) {
        console.error('Failed to list models', e);
        throw e; // Re-throw to be caught in UI
    }
}

export async function analyzePdf(file: File, apiKey: string, modelName: string): Promise<string> {
    if (!apiKey) throw new Error('API Key is missing');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const base64Data = await fileToGenerativePart(file);
    const prompt = `Analyze this PDF. 

1. Extract all text content and present it in a clean **Markdown** format.
2. **IMPORTANT**: Insert **'[Page X]'** at the beginning of each new page to support academic citations (e.g., [Page 1], [Page 2]).
3. **METADATA**: At the VERY END of the response, strictly append a JSON block having the following structure (do not use code blocks, just the raw JSON string):
{"title": "Document Title", "author": "Author Name", "publicationYear": "Year", "publisher": "Publisher"}
If specific fields are not found, use null.`;

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

            const fallbackCandidates = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
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

        if (error.message.includes('404')) {
            return `### 🚫 분석 실패: 모델을 찾을 수 없음 (404 Error)

선택하신 모델(**${modelName}**)을 현재 사용할 수 없습니다.

**💡 해결 방법:**
1. ⚙️ **설정(Settings)** 메뉴를 열어주세요.
2. **"🔌 Check Connection"** 버튼을 눌러 사용 가능한 모델 목록을 새로고침하세요.
3. 목록에서 **gemini-2.0-flash** 또는 **gemini-1.5-flash** 등 다른 모델을 선택하고 저장해 주세요.

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
