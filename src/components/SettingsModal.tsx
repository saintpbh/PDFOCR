// ... imports
import { getAvailableModels } from '../lib/gemini';

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
        const models = await getAvailableModels(apiKey);
        setIsLoadingModels(false);
        if (models.length > 0) {
            setAvailableModels(models);
            alert(`Connection Successful! Found ${models.length} available models.`);
            // Auto-select the first one if current is not in list (optional, but good UX)
            // But let's just let user choose from the datalist now populated
        } else {
            alert('Failed to fetch models. Check your API Key.');
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
                        <input
                            type="text"
                            value={modelName}
                            onChange={(e) => setModelName(e.target.value)}
                            placeholder="gemini-1.5-flash"
                            className="input-field"
                            list="model-options"
                        />
                        <datalist id="model-options">
                            {availableModels.length > 0 ? (
                                availableModels.map(m => <option key={m} value={m} />)
                            ) : (
                                <>
                                    <option value="gemini-1.5-flash" />
                                    <option value="gemini-1.5-pro" />
                                    <option value="gemini-pro" />
                                </>
                            )}
                        </datalist>
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
