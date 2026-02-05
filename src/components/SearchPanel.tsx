
import React, { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { Paragraph, CitationMetadata } from '../lib/parser';
import { BookmarkData, SavedCitation } from '../lib/bookmarks';

interface SearchPanelProps {
    paragraphs: Paragraph[];
    metadata: CitationMetadata;
    bookmarkData: BookmarkData;
    onToggleBookmark: (citation: SavedCitation) => void;
    isOpen: boolean;
    onClose: () => void;
}

export default function SearchPanel({
    paragraphs,
    metadata,
    bookmarkData,
    onToggleBookmark,
    isOpen,
    onClose
}: SearchPanelProps) {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<'search' | 'bookmarks'>('search');

    // Initialize Fuse
    const fuse = useMemo(() => {
        return new Fuse(paragraphs, {
            keys: ['text'],
            threshold: 0.4, // Fuzzy threshold (0.0 = exact match, 1.0 = match anything)
            includeScore: true,
            ignoreLocation: true // Search anywhere in the text
        });
    }, [paragraphs]);

    const results = useMemo(() => {
        if (!query) return [];
        return fuse.search(query).map(result => result.item);
    }, [query, fuse]);

    if (!isOpen) return null;

    const formatCitation = (para: Paragraph) => {
        // Chicago Style (Note): Author, *Title* (City: Publisher, Year), Page.
        const author = metadata.author || 'Unknown Author';
        const title = metadata.title || 'Unknown Title';
        const year = metadata.publicationYear || 'n.d.';

        return `${author}, *${title}* (${year}), p. ${para.page}.`;
    };

    const isBookmarked = (paraId: string) => {
        return bookmarkData.savedCitations.some(c => c.id === paraId);
    };

    return (
        <div className="search-panel settings-modal-overlay"> {/* Reuse overlay style */}
            <div className="settings-modal" style={{ width: '500px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                    <h2 style={{ margin: 0 }}>🔍 Search & Citations</h2>
                    <button onClick={onClose} className="btn-secondary">Close</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                    <button
                        className={`btn-secondary ${activeTab === 'search' ? 'active-tab' : ''}`}
                        onClick={() => setActiveTab('search')}
                        style={{ flex: 1, fontWeight: activeTab === 'search' ? 'bold' : 'normal', border: activeTab === 'search' ? '2px solid #2563eb' : '1px solid #ddd' }}
                    >
                        Search
                    </button>
                    <button
                        className={`btn-secondary ${activeTab === 'bookmarks' ? 'active-tab' : ''}`}
                        onClick={() => setActiveTab('bookmarks')}
                        style={{ flex: 1, fontWeight: activeTab === 'bookmarks' ? 'bold' : 'normal', border: activeTab === 'bookmarks' ? '2px solid #2563eb' : '1px solid #ddd' }}
                    >
                        Bookmarks ({bookmarkData.savedCitations.length})
                    </button>
                </div>

                {activeTab === 'search' ? (
                    <>
                        <input
                            type="text"
                            placeholder="Type to similar search..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '1rem' }}
                            autoFocus
                        />

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {query && results.length === 0 && <p style={{ color: '#888' }}>No results found.</p>}
                            {results.map((para) => (
                                <CitationCard
                                    key={para.id}
                                    para={para}
                                    citation={formatCitation(para)}
                                    isBookmarked={isBookmarked(para.id)}
                                    onToggle={() => onToggleBookmark({
                                        id: para.id,
                                        text: para.text,
                                        page: para.page,
                                        timestamp: Date.now()
                                    })}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {bookmarkData.savedCitations.length === 0 && <p style={{ color: '#888' }}>No bookmarks saved yet.</p>}
                        {bookmarkData.savedCitations.map((saved) => (
                            <CitationCard
                                key={saved.id}
                                para={{ id: saved.id, text: saved.text, page: saved.page }}
                                citation={formatCitation({ id: saved.id, text: saved.text, page: saved.page })}
                                isBookmarked={true}
                                onToggle={() => onToggleBookmark(saved)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CitationCard({ para, citation, isBookmarked, onToggle }: { para: Paragraph, citation: string, isBookmarked: boolean, onToggle: () => void }) {
    return (
        <div style={{
            border: '1px solid #eee',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#f9f9f9',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
        }}>
            {/* Paragraph Text Preview */}
            <p style={{ fontSize: '0.9rem', color: '#333', maxHeight: '100px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', marginBottom: '0.5rem' }}>
                {para.text}
            </p>

            {/* Citation Box */}
            <div style={{ backgroundColor: '#eef2ff', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem', color: '#4f46e5', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                {citation}
            </div>

            <button
                onClick={onToggle}
                style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: isBookmarked ? '#dc2626' : '#9ca3af',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem'
                }}
            >
                {isBookmarked ? '★ Bookmarked' : '☆ Add Bookmark'}
            </button>
        </div>
    );
}
