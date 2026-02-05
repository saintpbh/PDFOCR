import React, { useState, useEffect } from 'react';
import { getAvailableModels } from '../lib/gemini';

interface SettingsModalProps {
    onClose: () => void;
    isOpen: boolean;
}

export default function SettingsModal({ onClose, isOpen }: SettingsModalProps) {
    const [apiKey, setApiKey] = useState('');
    const [modelName, setModelName] = useState('gemini-1.5-flash');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);


    useEffect(() => {
        if (isOpen) {
            // Sync state from localStorage when modal opens
            const savedKey = localStorage.getItem('google_gemini_api_key');
            if (savedKey) setApiKey(savedKey);

            const savedModel = localStorage.getItem('google_gemini_model');
            if (savedModel) setModelName(savedModel);
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('google_gemini_api_key', apiKey);
        localStorage.setItem('google_gemini_model', modelName);
        alert('Settings Saved!');
        onClose();
    };

    const checkConnection = async () => {
        if (!apiKey) return alert('Please enter an API Key first');
        setIsLoadingModels(true);
        try {
            const models = await getAvailableModels(apiKey);
            setIsLoadingModels(false);

            if (models.length > 0) {
                setAvailableModels(models);
                alert(`Connection Successful! Found ${models.length} available models:\n` + models.slice(0, 5).join(', ') + (models.length > 5 ? '...' : ''));
            } else {
                alert('Connection Failed: No models found. Check if the API Key is valid and has "Generative Language API" enabled in Google Cloud Console.');
            }
        } catch (e: unknown) {
            setIsLoadingModels(false);
            const errorMessage = e instanceof Error ? e.message : String(e);
            alert(`Connection Error: ${errorMessage}`);
        }
    };


    if (!isOpen) return null;

    return (
        <div className="settings-modal-overlay">
            <div className="settings-modal glass-panel">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2 className="gradient-text" style={{ margin: 0 }}>⚙️ Settings</h2>
                    <button onClick={onClose} className="btn-icon">✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>Google Gemini API Key</label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                            Required for AI OCR & Analysis.
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ marginLeft: '0.5rem', color: 'var(--primary-solid)' }}>Get Free Key</a>
                        </p>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="input-field"
                        />
                        <button
                            onClick={checkConnection}
                            disabled={isLoadingModels}
                            style={{ marginTop: '0.5rem', fontSize: '0.8rem', width: '100%' }}
                            className="btn-secondary"
                        >
                            {isLoadingModels ? 'Checking...' : '🔌 Check Connection & Load Models'}
                        </button>
                    </div>

                    <div>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>AI Model</label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
                            Select the Gemini model to use.
                        </p>
                        <select
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            className="input-field"
                            style={{ backgroundColor: 'white', color: 'var(--text-main)' }}
                        >
                            {availableModels.length > 0 ? (
                                availableModels.map(m => <option key={m} value={m}>{m}</option>)
                            ) : (
                                <>
                                    <option value="gemini-1.5-flash">gemini-1.5-flash (Default)</option>
                                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                                    <option value="gemini-pro">gemini-pro</option>
                                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                                </>
                            )}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Save Changes</button>
                </div>
            </div>
        </div>
    );
}
