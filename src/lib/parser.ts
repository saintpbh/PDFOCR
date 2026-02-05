
export interface CitationMetadata {
    title: string | null;
    author: string | null;
    publicationYear: string | null;
    publisher: string | null;
}

export interface Paragraph {
    id: string; // Unique ID (e.g., hash or index)
    text: string;
    page: number;
}

export interface ParsedDocument {
    metadata: CitationMetadata;
    paragraphs: Paragraph[];
    rawText: string;
}

export function parseGeminiOutput(rawText: string): ParsedDocument {
    // 1. Extract Metadata JSON block
    let metadata: CitationMetadata = {
        title: null,
        author: null,
        publicationYear: null,
        publisher: null
    };

    let contentText = rawText;

    // Look for JSON block at the end
    // Logic: Find the last occurrence of "{" and "}" which looks like our metadata
    const jsonStartParams = rawText.lastIndexOf('{"title":');
    if (jsonStartParams !== -1) {
        const jsonEndParams = rawText.lastIndexOf('}');
        if (jsonEndParams > jsonStartParams) {
            try {
                const jsonStr = rawText.substring(jsonStartParams, jsonEndParams + 1);
                metadata = JSON.parse(jsonStr);
                // Remove JSON metadata from content text to keep it clean
                contentText = rawText.substring(0, jsonStartParams).trim();
            } catch (e) {
                console.error("Failed to parse metadata JSON", e);
            }
        }
    }

    // 2. Parse Paragraphs and Page Numbers
    const paragraphs: Paragraph[] = [];
    let currentPage = 1;

    // Split by double newline to identify paragraphs roughly
    const rawParagraphs = contentText.split(/\n\s*\n/);

    rawParagraphs.forEach((para, index) => {
        const trimmed = para.trim();
        if (!trimmed) return;

        // Check for Page Markers [Page X]
        const pageMatch = trimmed.match(/\[Page\s*(\d+)\]/i);
        if (pageMatch) {
            currentPage = parseInt(pageMatch[1], 10);
        }

        // Remove page marker from text display if preferred, or keep it. 
        // User might want to see it, but for "clean" search results we might want to strip it?
        // Let's keep it in the text for context, or strictly purely strippling it might be tricky if it's inline.
        // For citation purposes, we rely on `currentPage` variable.

        paragraphs.push({
            id: `p-${index}-${Date.now()}`, // simple unique ID
            text: trimmed,
            page: currentPage
        });
    });

    return {
        metadata,
        paragraphs,
        rawText: contentText // content without the JSON block
    };
}
