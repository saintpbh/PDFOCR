'use client';

import React, { useState, useEffect } from 'react';
import { saveDirectoryHandle, getDirectoryHandle } from '../lib/idb';
import SettingsModal from '../components/SettingsModal';
import { analyzePdf } from '../lib/gemini';
import { parseGeminiOutput, Paragraph, CitationMetadata } from '../lib/parser';
import { loadBookmarks, saveBookmarks, BookmarkData, SavedCitation } from '../lib/bookmarks';
import SearchPanel from '../components/SearchPanel';

interface FileEntry {
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemFileHandle;
}

export default function Home() {
    const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Analysis State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [showResult, setShowResult] = useState(false);

    // Search & Bookmark State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [parsedParagraphs, setParsedParagraphs] = useState<Paragraph[]>([]);
    const [metadata, setMetadata] = useState<CitationMetadata>({
        title: null, author: null, publicationYear: null, publisher: null
    });
    const [bookmarkData, setBookmarkData] = useState<BookmarkData>({
        metadata: { title: null, author: null, publicationYear: null, publisher: null },
        bookmarks: [],
        savedCitations: []
    });

    // Load handle on mount
    useEffect(() => {
        async function loadHandle() {
            const handle = await getDirectoryHandle();
            if (handle) {
                try {
                    // @ts-ignore
                    setRootHandle(handle);
                    listFiles(handle);
                } catch (e) {
                    console.error(e);
                }
            }
        }
        loadHandle();
    }, []);

    const listFiles = async (dirHandle: FileSystemDirectoryHandle) => {
        const entries: FileEntry[] = [];
        // @ts-ignore
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
                entries.push({ name: entry.name, kind: 'file', handle: entry as FileSystemFileHandle });
            }
        }
        setFiles(entries.sort((a, b) => a.name.localeCompare(b.name)));
    };

    const handleOpenFolder = async () => {
        try {
            // @ts-ignore
            const handle = await window.showDirectoryPicker();
            if (handle) {
                await saveDirectoryHandle(handle);
                setRootHandle(handle);
                listFiles(handle);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectFile = async (entry: FileEntry) => {
        setSelectedFile(entry);
        setAnalysisResult('');
        setShowResult(false);
        setParsedParagraphs([]); // Reset parsed data on file change

        // Create Blob URL for display
        const file = await entry.handle.getFile();
        const url = URL.createObjectURL(file);
        setFileUrl(url);

        if (!rootHandle) return;

        // 1. Try to load existing OCR result
        let textContent = '';
        const resultName = entry.name.replace('.pdf', '_OCR.md');
        try {
            const resultHandle = await rootHandle.getFileHandle(resultName);
            const resultFile = await resultHandle.getFile();
            textContent = await resultFile.text();

            // If exists, parse it directly
            const parsed = parseGeminiOutput(textContent + "\n\n"); // Add dummy newline just in case json block is missing or messy? 
            // Actually parser handles string.
            // But wait, if we saved ONLY the content text before, we might have lost the JSON block if we didn't save it in .md
            // The previous logic saved `text` returned from analyzePdf.
            // If `analyzePdf` returns `text + json`, then `text` variable holds that.

            // Wait, logic check: in runAnalysis below, we setAnalysResult(text).
            // If we parse here, we can setParsedParagraphs(parsed.paragraphs).

            // If we only saved "clean content" (rawText), then parseGeminiOutput won't find JSON if stripped.
            // But verify: parseGeminiOutput separates JSON and Content.

            setAnalysisResult(parsed.rawText);
            setParsedParagraphs(parsed.paragraphs);
            setShowResult(true);
        } catch (e) {
            // No result
        }

        // 2. Load Bookmarks & Metadata (Sidecar)
        const loadedBookmarks = await loadBookmarks(rootHandle, entry.name);
        setBookmarkData(loadedBookmarks);
        setMetadata(loadedBookmarks.metadata);
    };

    const runAnalysis = async () => {
        if (!selectedFile) return;

        const apiKey = localStorage.getItem('google_gemini_api_key');
        const modelName = localStorage.getItem('google_gemini_model') || 'gemini-1.5-flash';

        if (!apiKey) {
            setIsSettingsOpen(true);
            alert('Please save your Google Gemini API Key first.');
            return;
        }

        setIsAnalyzing(true);
        setShowResult(true);
        try {
            const file = await selectedFile.handle.getFile();
            // This returns Raw Text + JSON Block
            const fullOutput = await analyzePdf(file, apiKey, modelName);

            // Parse it
            const parsed = parseGeminiOutput(fullOutput);

            setAnalysisResult(parsed.rawText); // Display only text
            setParsedParagraphs(parsed.paragraphs);
            setMetadata(parsed.metadata); // Set structured metadata

            // Auto Save Content (_OCR.md)
            if (rootHandle) {
                const resultName = selectedFile.name.replace('.pdf', '_OCR.md');
                const fileHandle = await rootHandle.getFileHandle(resultName, { create: true });
                // @ts-ignore
                const writable = await fileHandle.createWritable();
                // We save the FULL output (Text + JSON) so we can re-parse it later?
                // OR we save just text?
                // If we want to re-load metadata from _OCR.md later without _meta.json, we should save fullOutput.
                // But we are using _meta.json for metadata.
                // Let's save fullOutput to _OCR.md to preserve the AI's full response.
                await writable.write(fullOutput);
                await writable.close();
                console.log('Result saved to _OCR.md');

                // Save Metadata & Empty Bookmarks to _meta.json
                const newBookmarkData: BookmarkData = {
                    metadata: parsed.metadata,
                    bookmarks: [],
                    savedCitations: []
                };
                await saveBookmarks(rootHandle, selectedFile.name, newBookmarkData);
                setBookmarkData(newBookmarkData);
            }

        } catch (e: any) {
            let errorMsg = e.message || e.toString();
            if (errorMsg.includes('429')) {
                errorMsg = `⚠️ 사용량 초과 (429 Error)\n\n무료 사용량을 초과했습니다. 유료(Pay-as-you-go)로 전환하려면 Google Cloud Console에서 결제 계정을 연결(Link)해야 합니다.\n\n그렇지 않으면 약 1분 후 다시 시도해주세요.`;
            }
            alert('분석 실패: ' + errorMsg);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toggleBookmark = async (citation: SavedCitation) => {
        if (!selectedFile || !rootHandle) return;

        const exists = bookmarkData.savedCitations.some(c => c.id === citation.id);
        let newCitations = [];

        if (exists) {
            newCitations = bookmarkData.savedCitations.filter(c => c.id !== citation.id);
        } else {
            newCitations = [...bookmarkData.savedCitations, citation];
        }

        const newData = {
            ...bookmarkData,
            savedCitations: newCitations
        };

        setBookmarkData(newData);
        await saveBookmarks(rootHandle, selectedFile.name, newData);
    };

    return (
        <main className="app-container">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="toolbar">
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }} className="gradient-text">📚 AI PDF Manager</h3>
                </div>

                <div style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleOpenFolder} className="btn-secondary" style={{ flex: 1 }}>📂 Open Folder</button>
                    <button onClick={() => setIsSettingsOpen(true)} className="btn-icon">⚙️</button>
                </div>

                <div className="file-list">
                    {files.length === 0 && (
                        <div style={{ padding: '1rem', color: '#94a3b8', textAlign: 'center' }}>
                            {rootHandle ? 'No PDF files found' : 'Select a folder to start'}
                        </div>
                    )}
                    {files.map(file => (
                        <div
                            key={file.name}
                            className={`file-item ${selectedFile?.name === file.name ? 'active' : ''}`}
                            onClick={() => handleSelectFile(file)}
                        >
                            <span className="file-icon">📄</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        </div>
                    ))}
                </div>
            </aside>

            {/* Main Content */}
            <section className="main-content">
                {selectedFile && fileUrl ? (
                    <div style={{ display: 'flex', flex: 1, flexDirection: 'column', height: '100%' }}>
                        {/* Top Controls */}
                        <div className="toolbar" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{selectedFile.name}</span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    className="btn-secondary"
                                    title="Search & Bookmarks"
                                >
                                    🔍 Search
                                </button>
                                <button
                                    onClick={() => setShowResult(!showResult)}
                                    className="btn-secondary"
                                >
                                    {showResult ? 'Show PDF' : 'Show Result'}
                                </button>
                                <button
                                    onClick={runAnalysis}
                                    className="btn-primary"
                                    disabled={isAnalyzing}
                                >
                                    {isAnalyzing ? 'Analyzing...' : '✨ Create OCR / Analyze'}
                                </button>
                            </div>
                        </div>

                        {/* View Area */}
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                            {!showResult ? (
                                <embed
                                    src={`${fileUrl}#toolbar=0`}
                                    type="application/pdf"
                                    width="100%"
                                    height="100%"
                                />
                            ) : (
                                <div style={{ height: '100%', padding: '2rem', overflowY: 'auto', background: 'white' }}>
                                    {isAnalyzing && (
                                        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                                            <div className="spinner"></div>
                                            <p>AI is analyzing document...</p>
                                        </div>
                                    )}
                                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: '1.6' }}>
                                        {analysisResult}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: '#94a3b8' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👆</div>
                        <p>Select a PDF file to view</p>
                    </div>
                )}
            </section>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

            {/* Search Panel Overlay */}
            <SearchPanel
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                paragraphs={parsedParagraphs}
                metadata={metadata}
                bookmarkData={bookmarkData}
                onToggleBookmark={toggleBookmark}
            />
        </main>
    );
}
