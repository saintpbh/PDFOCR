import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
    onClose: () => void;
    isOpen: boolean;
}

export default function SettingsModal({ onClose, isOpen }: SettingsModalProps) {
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            const saved = localStorage.getItem('google_gemini_api_key');
            if (saved) setApiKey(saved);
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('google_gemini_api_key', apiKey);
        alert('API Key Saved!');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-panel">
                <div className="modal-header">
                    <h2>⚙️ Settings</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label>Google Gemini API Key</label>
                        <p className="description">
                            Required for AI OCR & Analysis.
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get Free Key</a>
                        </p>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="input-field"
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Save Changes</button>
                </div>
            </div>
        </div>
    );
}
