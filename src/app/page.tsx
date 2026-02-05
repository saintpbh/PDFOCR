'use client';

import React, { useState, useEffect } from 'react';
import { saveDirectoryHandle, getDirectoryHandle } from '../lib/idb';
import SettingsModal from '../components/SettingsModal';
import { analyzePdf } from '../lib/gemini';

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

    // Load handle on mount
    useEffect(() => {
        async function loadHandle() {
            const handle = await getDirectoryHandle();
            if (handle) {
                // Verify permission if needed, for now just try usage
                // Chrome usually persists for a session or site unless cleared
                try {
                    // @ts-ignore - query permission might fail if not fully supported but let's assume valid
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

        // Create Blob URL for display
        const file = await entry.handle.getFile();
        const url = URL.createObjectURL(file);
        setFileUrl(url);

        // Check if result already exists (e.g., filename_ocr.md)
        if (rootHandle) {
            const resultName = entry.name.replace('.pdf', '_ocr.md');
            try {
                const resultHandle = await rootHandle.getFileHandle(resultName);
                const resultFile = await resultHandle.getFile();
                const text = await resultFile.text();
                setAnalysisResult(text);
                setShowResult(true); // Show stored result automatically if exists
            } catch (e) {
                // No result exists
            }
        }
    };

    const runAnalysis = async () => {
        if (!selectedFile) return;

        const apiKey = localStorage.getItem('google_gemini_api_key');
        if (!apiKey) {
            setIsSettingsOpen(true);
            alert('Please save your Google Gemini API Key first.');
            return;
        }

        setIsAnalyzing(true);
        setShowResult(true);
        try {
            const file = await selectedFile.handle.getFile();
            const text = await analyzePdf(file, apiKey);
            setAnalysisResult(text);

            // Auto Save to file
            if (rootHandle) {
                const resultName = selectedFile.name.replace('.pdf', '_ocr.md');
                const fileHandle = await rootHandle.getFileHandle(resultName, { create: true });
                // @ts-ignore
                const writable = await fileHandle.createWritable();
                await writable.write(text);
                await writable.close();
                console.log('Result saved');
            }

        } catch (e) {
            alert('Analysis Failed: ' + e);
        } finally {
            setIsAnalyzing(false);
        }
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
                        <div className="toolbar" style={{ padding: '0.5rem 1rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 600 }}>{selectedFile.name}</span>
                            <div>
                                <button
                                    onClick={() => setShowResult(!showResult)}
                                    className="btn-secondary"
                                    style={{ marginRight: '1rem' }}
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
        </main>
    );
}
