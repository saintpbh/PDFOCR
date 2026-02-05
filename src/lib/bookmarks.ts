
import { CitationMetadata } from './parser';

export interface BookmarkData {
    metadata: CitationMetadata;
    bookmarks: string[]; // List of Paragraph IDs or texts that are bookmarked
    // We might need to store the full paragraph data if we want to show them without re-parsing the original large text file every time?
    // For simplicity, we assume we always have the main document open when viewing bookmarks, or we store a snapshot.
    savedCitations: SavedCitation[];
}

export interface HighlightArea {
    page: number;
    x: number; // Percentage (0-100)
    y: number; // Percentage (0-100)
    width: number; // Percentage (0-100)
    height: number; // Percentage (0-100)
}

export interface SavedCitation {
    id: string;
    text: string;
    page: number;
    timestamp: number;
    highlight?: {
        color: string; // Hex code
        opacity: number; // 0.0 - 1.0
        areas: HighlightArea[];
    };
}

// Sidecar filename: "filename.pdf_meta.json" or similar
export function getMetaFileName(pdfFileName: string): string {
    return pdfFileName.replace('.pdf', '_meta.json');
}

export async function loadBookmarks(
    rootHandle: FileSystemDirectoryHandle,
    pdfFileName: string
): Promise<BookmarkData> {
    const metaFileName = getMetaFileName(pdfFileName);
    const defaultData: BookmarkData = {
        metadata: { title: null, author: null, publicationYear: null, publisher: null },
        bookmarks: [],
        savedCitations: []
    };

    try {
        const fileHandle = await rootHandle.getFileHandle(metaFileName);
        const file = await fileHandle.getFile();
        const text = await file.text();
        return JSON.parse(text);
    } catch (e) {
        // File doesn't exist yet, return default
        return defaultData;
    }
}

export async function saveBookmarks(
    rootHandle: FileSystemDirectoryHandle,
    pdfFileName: string,
    data: BookmarkData
) {
    const metaFileName = getMetaFileName(pdfFileName);
    try {
        const fileHandle = await rootHandle.getFileHandle(metaFileName, { create: true });
        // @ts-ignore
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    } catch (e) {
        console.error("Failed to save bookmarks", e);
    }
}
