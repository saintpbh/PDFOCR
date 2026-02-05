
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { SavedCitation, HighlightArea } from '../lib/bookmarks';

// Configure PDF.js worker
// We use a CDN for the worker to avoid build issues with Next.js/Webpack for now.
// Alternatively can copya file public/pdf.worker.min.mjs
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    fileUrl: string;
    onBookmark: (text: string, page: number, highlight?: { color: string, opacity: number, areas: HighlightArea[] }) => void;
    bookmarks?: SavedCitation[];
}

const options = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
};

export default function PDFViewer({ fileUrl, onBookmark, bookmarks }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageWidth, setPageWidth] = useState<number>(600);
    const containerRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<{ text: string; page: number; x: number; y: number; areas: HighlightArea[] } | null>(null);

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




    // We need to render highlights on top of pages
    // We filter citations that have highlights and belong to the current page
    const renderHighlights = (pageNumber: number) => {
        // We need to access the 'bookmarks' prop which we will receive
        // But first let's update the props interface
        return (
            <div className="highlight-overlay" style={{ width: '100%', height: '100%' }}>
                {bookmarks?.map(bookmark => {
                    if (bookmark.highlight && bookmark.highlight.areas) {
                        return bookmark.highlight.areas
                            .filter(area => area.page === pageNumber)
                            .map((area, idx) => (
                                <div
                                    key={`${bookmark.id}_${idx}`}
                                    className="highlight-rect"
                                    style={{
                                        left: `${area.x}%`,
                                        top: `${area.y}%`,
                                        width: `${area.width}%`,
                                        height: `${area.height}%`,
                                        backgroundColor: bookmark.highlight?.color,
                                        opacity: bookmark.highlight?.opacity
                                    }}
                                />
                            ));
                    }
                    return null;
                })}
            </div>
        );
    };

    const handleSelection = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
            setSelection(null);
            return;
        }

        const text = sel.toString().trim();
        if (!text) return;

        // Try to find which page this selection belongs to
        let node = sel.anchorNode;
        let pageNumber = 1;
        let pageElement: HTMLElement | null = null;

        while (node && node !== document.body) {
            if (node instanceof Element && node.classList.contains('react-pdf__Page')) {
                pageElement = node as HTMLElement;
                const pageAttr = node.getAttribute('data-page-number');
                if (pageAttr) pageNumber = parseInt(pageAttr, 10);
                break;
            }
            node = node.parentNode;
        }

        if (!pageElement) return;

        // Calculate highlights
        const range = sel.getRangeAt(0);
        const rects = range.getClientRects();
        const pageRect = pageElement.getBoundingClientRect();

        const areas = Array.from(rects).map(rect => ({
            page: pageNumber,
            x: ((rect.left - pageRect.left) / pageRect.width) * 100,
            y: ((rect.top - pageRect.top) / pageRect.height) * 100,
            width: (rect.width / pageRect.width) * 100,
            height: (rect.height / pageRect.height) * 100
        }));

        // Position for floating button
        // Use the last rect for button positioning or the bounding rect of range
        const boundingRect = range.getBoundingClientRect();

        setSelection({
            text,
            page: pageNumber,
            x: boundingRect.left + (boundingRect.width / 2),
            y: boundingRect.top - 10,
            areas: areas
        });

    }, []);

    const [selectedColor, setSelectedColor] = useState('#fef08a'); // Default Yellow-200
    const [opacity, setOpacity] = useState(0.4);

    const colors = [
        '#fef08a', // Yellow
        '#bbf7d0', // Green
        '#bfdbfe', // Blue
        '#fbcfe8', // Pink
        '#e9d5ff', // Purple
    ];



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
                options={options}
            >
                {Array.from(new Array(numPages), (el, index) => (
                    <div key={`page_wrapper_${index + 1}`} style={{ position: 'relative' }}>
                        <Page
                            key={`page_${index + 1}`}
                            pageNumber={index + 1}
                            width={pageWidth}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                        >
                            {renderHighlights(index + 1)}
                        </Page>
                    </div>
                ))}
            </Document>

            {selection && (
                <div
                    className="floating-bookmark-btn"
                    style={{
                        top: selection.y - 100, // Move up to accommodate color picker
                        left: selection.x - 75,
                        position: 'fixed',
                        zIndex: 100,
                        backgroundColor: 'white',
                        padding: '0.5rem',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        border: '1px solid #e2e8f0'
                    }}
                    onMouseDown={(e) => e.stopPropagation()} // Prevent closing
                >
                    <div className="color-picker-row">
                        {colors.map(color => (
                            <div
                                key={color}
                                className={`color-dot ${selectedColor === color ? 'selected' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => setSelectedColor(color)}
                            />
                        ))}
                    </div>

                    <button
                        className="btn-primary"
                        style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            onBookmark(selection.text, selection.page, {
                                color: selectedColor,
                                opacity: opacity,
                                areas: selection.areas
                            });
                            setSelection(null);
                            window.getSelection()?.removeAllRanges();
                        }}
                    >
                        <span>🔖</span> Save
                    </button>
                </div>
            )}
        </div>
    );
}
