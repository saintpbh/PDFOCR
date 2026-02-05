
import React, { useState, useMemo } from 'react';
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
            threshold: 0.4,
            includeScore: true,
            ignoreLocation: true
        });
    }, [paragraphs]);

    const results = useMemo(() => {
        if (!query) return [];
        return fuse.search(query).map(result => result.item);
    }, [query, fuse]);

    if (!isOpen) return null;

    const formatCitation = (para: Paragraph) => {
        const author = metadata.author || 'Unknown Author';
        const title = metadata.title || 'Unknown Title';
        const year = metadata.publicationYear || 'n.d.';
        return `${author}, *${title}* (${year}), p. ${para.page}.`;
    };

    const isBookmarked = (paraId: string) => {
        return bookmarkData.savedCitations.some(c => c.id === paraId);
    };

    return (
        <div className="settings-modal-overlay">
            <div className="settings-modal glass-panel" style={{ width: '550px', height: '85vh', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 className="gradient-text" style={{ margin: 0, fontSize: '1.5rem' }}>🔍 Intelligent Search</h2>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.03)', padding: '4px', borderRadius: '12px' }}>
                    <button
                        className={`btn-secondary ${activeTab === 'search' ? 'active-tab' : ''}`}
                        onClick={() => setActiveTab('search')}
                        style={{
                            flex: 1,
                            border: 'none',
                            background: activeTab === 'search' ? 'white' : 'transparent',
                            boxShadow: activeTab === 'search' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                            fontWeight: activeTab === 'search' ? 600 : 500,
                            borderRadius: '8px'
                        }}
                    >
                        Search
                    </button>
                    <button
                        className={`btn-secondary ${activeTab === 'bookmarks' ? 'active-tab' : ''}`}
                        onClick={() => setActiveTab('bookmarks')}
                        style={{
                            flex: 1,
                            border: 'none',
                            background: activeTab === 'bookmarks' ? 'white' : 'transparent',
                            boxShadow: activeTab === 'bookmarks' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
                            fontWeight: activeTab === 'bookmarks' ? 600 : 500,
                            borderRadius: '8px'
                        }}
                    >
                        Bookmarks ({bookmarkData.savedCitations.length})
                    </button>
                </div>

                {activeTab === 'search' ? (
                    <>
                        <input
                            type="text"
                            placeholder="Type keywords to search..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="input-field"
                            style={{ marginBottom: '1.5rem' }}
                            autoFocus
                        />

                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {query && results.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>No results found.</p>}
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
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                        {bookmarkData.savedCitations.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>No bookmarks saved yet.</p>}
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
            border: '1px solid rgba(0,0,0,0.06)',
            borderRadius: '16px',
            padding: '1.25rem',
            marginBottom: '1rem',
            backgroundColor: 'white',
            boxShadow: '0 4px 6px -2px rgba(0,0,0,0.02)',
            transition: 'transform 0.2s',
        }}>
            {/* Paragraph Text Preview */}
            <p style={{ fontSize: '0.95rem', color: 'var(--text-main)', lineHeight: '1.6', maxHeight: '120px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', marginBottom: '0.75rem' }}>
                {para.text}
            </p>

            {/* Citation Box */}
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--secondary-color)', marginBottom: '0.75rem', fontStyle: 'italic', border: '1px solid #f1f5f9' }}>
                {citation}
            </div>

            <button
                onClick={onToggle}
                style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: isBookmarked ? '#ef4444' : '#cbd5e1',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.85rem',
                    transition: 'color 0.2s'
                }}
            >
                <span style={{ fontSize: '1.1rem' }}>{isBookmarked ? '★' : '☆'}</span>
                {isBookmarked ? 'Saved' : 'Save Bookmark'}
            </button>
        </div>
    );
}
