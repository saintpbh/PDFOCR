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
        } catch (e: any) {
            setIsLoadingModels(false);
            alert(`Connection Error: ${e.message || e.toString()}`);
        }
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
                        <button
                            onClick={checkConnection}
                            disabled={isLoadingModels}
                            style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                            className="btn-secondary"
                        >
                            {isLoadingModels ? 'Checking...' : '🔌 Check Connection & Load Models'}
                        </button>
                    </div>

                    <div className="form-group" style={{ marginTop: '1.5rem' }}>
                        <label>AI Model</label>
                        <p className="description">
                            Select the Gemini model to use. Try <b>gemini-1.5-flash</b>, <b>gemini-1.5-pro</b>, or <b>gemini-pro</b>.
                        </p>
                        <select
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            className="input-field"
                            style={{ backgroundColor: 'white', color: 'black' }}
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

                <div className="modal-footer">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Save Changes</button>
                </div>
            </div>
        </div>
    );
}
