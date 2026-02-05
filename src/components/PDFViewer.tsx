
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
// We use a CDN for the worker to avoid build issues with Next.js/Webpack for now.
// Alternatively can copya file public/pdf.worker.min.mjs
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    fileUrl: string;
    onBookmark: (text: string, page: number) => void;
}

export default function PDFViewer({ fileUrl, onBookmark }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageWidth, setPageWidth] = useState<number>(600);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<{ text: string; page: number; x: number; y: number } | null>(null);

    // Resize handling
    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                setPageWidth(containerRef.current.clientWidth - 40); // 40px padding
            }
        };
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    // Text Selection Handler
    const handleSelection = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
            setSelection(null);
            return;
        }

        const text = sel.toString().trim();
        if (!text) return;

        // Try to find which page this selection belongs to
        // We look for the closest .react-pdf__Page ancestor
        let node = sel.anchorNode;
        let pageNumber = 1;

        while (node && node !== document.body) {
            if (node instanceof Element && node.classList.contains('react-pdf__Page')) {
                const pageAttr = node.getAttribute('data-page-number');
                if (pageAttr) pageNumber = parseInt(pageAttr, 10);
                break;
            }
            node = node.parentNode;
        }

        // Calculate position for the floating button
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Relative to the container (so it scrolls with it? or fixed?)
        // If we use fixed position for the button, we use rect.left/rect.top
        // But we need to handle scrolling window.

        setSelection({
            text,
            page: pageNumber,
            x: rect.left + (rect.width / 2),
            y: rect.top - 10 // Above the selection
        });

    }, []);

    return (
        <div
            className="pdf-viewer-container"
            ref={containerRef}
            onMouseUp={handleSelection}
        >
            <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div className="spinner"></div>}
                error={<div style={{ color: 'red' }}>Failed to load PDF.</div>}
            >
                {Array.from(new Array(numPages), (el, index) => (
                    <Page
                        key={`page_${index + 1}`}
                        pageNumber={index + 1}
                        width={pageWidth}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                    />
                ))}
            </Document>

            {selection && (
                <button
                    className="floating-bookmark-btn"
                    style={{
                        top: selection.y - 40,
                        left: selection.x - 60,
                        position: 'fixed' // Fixed usually safer for simple overlay
                    }}
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent clearing selection immediately
                        onBookmark(selection.text, selection.page);
                        setSelection(null);
                        window.getSelection()?.removeAllRanges();
                    }}
                    onMouseDown={(e) => e.preventDefault()} // Prevent stealing focus
                >
                    <span>🔖</span> Bookmark this
                </button>
            )}
        </div>
    );
}
