'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { saveDirectoryHandle, getDirectoryHandle } from '../lib/idb';
import SettingsModal from '../components/SettingsModal';
import { analyzePdf } from '../lib/gemini';
import { parseGeminiOutput, Paragraph, CitationMetadata } from '../lib/parser';
import { loadBookmarks, saveBookmarks, BookmarkData, SavedCitation } from '../lib/bookmarks';
import SearchPanel from '../components/SearchPanel';

// Dynamically import PDFViewer to avoid SSR issues with canvas/pdfjs
const PDFViewer = dynamic(() => import('../components/PDFViewer'), {
    ssr: false,
    loading: () => <div style={{ display: 'flex', justifyContent: 'center', marginTop: '5rem' }}><div className="spinner"></div></div>
});

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

    // Sidebar Tab State
    const [sidebarTab, setSidebarTab] = useState<'files' | 'bookmarks'>('files');

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
        setParsedParagraphs([]);
        setSidebarTab('files'); // Default to files when switching

        // Create Blob URL for display
        const file = await entry.handle.getFile();
        const url = URL.createObjectURL(file);
        setFileUrl(url);

        if (!rootHandle) return;

        // 1. Load OCR Result
        const resultName = entry.name.replace('.pdf', '_OCR.md');
        try {
            const resultHandle = await rootHandle.getFileHandle(resultName);
            const resultFile = await resultHandle.getFile();
            const textContent = await resultFile.text();

            const parsed = parseGeminiOutput(textContent + "\n\n");
            setAnalysisResult(parsed.rawText);
            setParsedParagraphs(parsed.paragraphs);
            setShowResult(false); // Default to PDF view
        } catch (e) {
            // No result
        }

        // 2. Load Bookmarks
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
            const fullOutput = await analyzePdf(file, apiKey, modelName);
            const parsed = parseGeminiOutput(fullOutput);

            setAnalysisResult(parsed.rawText);
            setParsedParagraphs(parsed.paragraphs);
            setMetadata(parsed.metadata);

            if (rootHandle) {
                const resultName = selectedFile.name.replace('.pdf', '_OCR.md');
                const fileHandle = await rootHandle.getFileHandle(resultName, { create: true });
                // @ts-ignore
                const writable = await fileHandle.createWritable();
                await writable.write(fullOutput);
                await writable.close();

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
                errorMsg = `⚠️ 사용량 초과 (429 Error)\n\n무료 사용량을 초과했습니다.`;
            }
            alert('분석 실패: ' + errorMsg);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAddBookmark = async (text: string, page: number) => {
        if (!selectedFile || !rootHandle) return;

        const newCitation: SavedCitation = {
            id: Date.now().toString(),
            text: text,
            page: page,
            timestamp: Date.now()
        };

        const newData = {
            ...bookmarkData,
            savedCitations: [...bookmarkData.savedCitations, newCitation]
        };

        setBookmarkData(newData);
        await saveBookmarks(rootHandle, selectedFile.name, newData);

        // Auto-switch to bookmarks tab to show feedback
        setSidebarTab('bookmarks');
    };

    const deleteBookmark = async (id: string) => {
        if (!selectedFile || !rootHandle) return;
        const newData = {
            ...bookmarkData,
            savedCitations: bookmarkData.savedCitations.filter(c => c.id !== id)
        };
        setBookmarkData(newData);
        await saveBookmarks(rootHandle, selectedFile.name, newData);
    };

    const copyToClipboard = (text: string, citation: SavedCitation) => {
        // Format: "Text" (Author, Year, p. Page)
        const author = metadata.author || 'Unknown';
        const year = metadata.publicationYear || 'n.d.';
        const formatted = `"${citation.text}" (${author}, ${year}, p. ${citation.page})`;

        navigator.clipboard.writeText(formatted).then(() => {
            alert('Copied to clipboard!');
        });
    };

    return (
        <main className="app-container">
            {/* Glass Sidebar */}
            <aside className="sidebar glass-sidebar">
                <div style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }} className="gradient-text">📚 AI PDF Manager</h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Local First & AI Powered</p>
                </div>

                <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleOpenFolder} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>📂</span> Open Folder
                    </button>
                    <button onClick={() => setIsSettingsOpen(true)} className="btn-icon" title="Setting">
                        <span>⚙️</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="sidebar-tabs">
                    <div
                        className={`sidebar-tab ${sidebarTab === 'files' ? 'active' : ''}`}
                        onClick={() => setSidebarTab('files')}
                    >
                        Files
                    </div>
                    <div
                        className={`sidebar-tab ${sidebarTab === 'bookmarks' ? 'active' : ''}`}
                        onClick={() => setSidebarTab('bookmarks')}
                    >
                        Bookmarks
                    </div>
                </div>

                {sidebarTab === 'files' ? (
                    <div className="file-list" style={{ flex: 1, overflowY: 'auto' }}>
                        {files.length === 0 && (
                            <div style={{ padding: '2rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.9rem' }}>
                                {rootHandle ? 'No PDF files found' : 'Select a folder to start'}
                            </div>
                        )}
                        {files.map(file => (
                            <div
                                key={file.name}
                                className={`file-item ${selectedFile?.name === file.name ? 'active' : ''}`}
                                onClick={() => handleSelectFile(file)}
                            >
                                <span className="file-icon" style={{ opacity: selectedFile?.name === file.name ? 1 : 0.5 }}>📄</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc' }}>
                        {bookmarkData.savedCitations.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                <p>No bookmarks yet.</p>
                                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Highlight text in the PDF to add a bookmark.</p>
                            </div>
                        ) : (
                            bookmarkData.savedCitations.map(cit => {
                                const author = metadata.author || 'Unknown';
                                const year = metadata.publicationYear || 'n.d.';
                                const refShort = `${author}, ${year}, p.${cit.page}`;

                                return (
                                    <div key={cit.id} className="bookmark-item">
                                        <button
                                            className="copy-btn"
                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(cit.text, cit); }}
                                            title="Copy to Clipboard"
                                        >
                                            📋 Copy
                                        </button>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem', lineHeight: '1.5' }}>
                                            "{cit.text}"
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            <span style={{ fontStyle: 'italic' }}>{refShort}</span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); deleteBookmark(cit.id); }}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <section className="main-content">
                {selectedFile && fileUrl ? (
                    <>
                        {/* Floating Toolbar */}
                        <div className="toolbar-floating">
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedFile.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {isAnalyzing ? 'Processing...' : (metadata.title ? `${metadata.title} (${metadata.publicationYear})` : 'Ready')}
                                </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    className="btn-secondary"
                                    title="Search & Bookmarks"
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                >
                                    <span>🔍</span> Search
                                </button>

                                <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>

                                <button
                                    onClick={() => setShowResult(!showResult)}
                                    className="btn-secondary"
                                >
                                    {showResult ? 'View PDF' : 'View Analysis'}
                                </button>
                                <button
                                    onClick={runAnalysis}
                                    className="btn-primary"
                                    disabled={isAnalyzing}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    {isAnalyzing ? (
                                        <><span>⏳</span> Analyzing...</>
                                    ) : (
                                        <><span>✨</span> Analyze PDF</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Viewer Card */}
                        <div className="viewer-card">
                            {!showResult ? (
                                <PDFViewer fileUrl={fileUrl} onBookmark={handleAddBookmark} />
                            ) : (
                                <div style={{ height: '100%', padding: '3rem', overflowY: 'auto', background: 'white' }}>
                                    {isAnalyzing && (
                                        <div style={{ textAlign: 'center', marginTop: '5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div className="spinner"></div>
                                            <h3 style={{ marginBottom: '0.5rem' }}>AI is reading your document...</h3>
                                            <p style={{ color: 'var(--text-muted)' }}>Extracting text, identifying structure, and finding citations.</p>
                                        </div>
                                    )}
                                    <article className="prose" style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.8' }}>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--text-main)', fontSize: '1.05rem' }}>
                                            {analysisResult}
                                        </pre>
                                    </article>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                        <div style={{
                            background: 'white',
                            padding: '3rem',
                            borderRadius: '50%',
                            boxShadow: 'var(--shadow-card)',
                            marginBottom: '2rem',
                            fontSize: '4rem',
                            width: '120px',
                            height: '120px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            📚
                        </div>
                        <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>No File Selected</h2>
                        <p>Select a PDF file from the sidebar to view or analyze.</p>
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
                onToggleBookmark={(citation) => {
                    // Adapter for legacy toggle
                    deleteBookmark(citation.id);
                }}
            />
        </main>
    );
}
