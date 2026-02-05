import { GoogleGenerativeAI } from '@google/generative-ai';

export async function analyzePdf(file: File, apiKey: string, promptText?: string): Promise<string> {
    if (!apiKey) throw new Error('API Key is missing');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Convert file to base64
    const base64Data = await fileToGenerativePart(file);

    const prompt = promptText || "Analyze this PDF. Extract all text content and present it in a clean Markdown format. If there are tables or forms, represent them structurally.";

    try {
        const result = await model.generateContent([
            prompt,
            base64Data
        ]);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error('Gemini API Error:', error);
        return `Error: ${error.message}`;
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
