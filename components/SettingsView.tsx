
import React, { useState, useEffect } from 'react';
import { 
    saveGeminiApiKey, getCustomGeminiApiKey,
    saveOpenRouterApiKey, getOpenRouterApiKey,
    saveApiProvider, getApiProvider, ApiProvider
} from '../utils/apiKey';

export const SettingsView: React.FC = () => {
    const [geminiKey, setGeminiKey] = useState('');
    const [openRouterKey, setOpenRouterKey] = useState('');
    const [apiProvider, setApiProvider] = useState<ApiProvider>('gemini');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        setGeminiKey(getCustomGeminiApiKey() || '');
        setOpenRouterKey(getOpenRouterApiKey() || '');
        setApiProvider(getApiProvider());
    }, []);

    const handleSave = () => {
        setSaveStatus('saving');
        saveGeminiApiKey(geminiKey);
        saveOpenRouterApiKey(openRouterKey);
        saveApiProvider(apiProvider);
        setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 500);
    };

    return (
        <div className="w-full h-full flex flex-col items-center p-4 pt-8 font-sans">
            <div className="w-full max-w-2xl flex-grow flex flex-col space-y-8">
                <header>
                    <h2 className="text-2xl text-gray-300">Settings</h2>
                    <p className="text-gray-500">Configure your API provider and keys. Your keys are stored only in your browser.</p>
                </header>
                
                <section className="p-6 border border-amber-800/20 rounded-lg bg-gradient-to-b from-amber-950/20 to-black/20 backdrop-blur-sm shadow-2xl shadow-black/30 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-amber-200/80 mb-2">
                            API Provider
                        </label>
                        <div className="flex space-x-4 rounded-lg bg-black/40 p-1">
                            <button 
                                onClick={() => setApiProvider('gemini')}
                                className={`flex-1 py-2 text-sm rounded-md transition-colors ${apiProvider === 'gemini' ? 'bg-amber-600/80 text-white font-semibold' : 'hover:bg-gray-700/50'}`}
                            >
                                Google Gemini
                            </button>
                            <button 
                                onClick={() => setApiProvider('openrouter')}
                                className={`flex-1 py-2 text-sm rounded-md transition-colors ${apiProvider === 'openrouter' ? 'bg-amber-600/80 text-white font-semibold' : 'hover:bg-gray-700/50'}`}
                            >
                                OpenRouter
                            </button>
                        </div>
                         <p className="text-xs text-gray-500 mt-2">
                            The real-time Agent (voice) view is only available with Google Gemini.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label htmlFor="gemini-key" className="block text-sm font-medium text-amber-200/80 mb-1">
                                Gemini API Key
                            </label>
                            <input
                                id="gemini-key"
                                type="password"
                                value={geminiKey}
                                onChange={(e) => setGeminiKey(e.target.value)}
                                placeholder="Enter your Google Gemini API key"
                                className="w-full bg-black/50 border border-amber-800/40 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all placeholder:text-amber-200/40"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Google AI Studio</a>.
                            </p>
                        </div>
                        
                        <div>
                            <label htmlFor="openrouter-key" className="block text-sm font-medium text-amber-200/80 mb-1">
                                OpenRouter API Key
                            </label>
                            <input
                                id="openrouter-key"
                                type="password"
                                value={openRouterKey}
                                onChange={(e) => setOpenRouterKey(e.target.value)}
                                placeholder="Enter your OpenRouter API key"
                                className="w-full bg-black/50 border border-amber-800/40 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all placeholder:text-amber-200/40"
                            />
                             <p className="text-xs text-gray-500 mt-1">
                                Get your key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">OpenRouter</a>.
                            </p>
                        </div>
                    </div>
                </section>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-amber-600/80 text-white font-bold rounded-md hover:bg-amber-500/80 transition-colors w-32"
                    >
                        {saveStatus === 'idle' && 'Save'}
                        {saveStatus === 'saving' && <div className="w-5 h-5 mx-auto border-2 border-t-transparent border-white rounded-full animate-spin"></div>}
                        {saveStatus === 'saved' && 'Saved!'}
                    </button>
                </div>
                
                 <section className="text-sm text-gray-500">
                    <h4 className="font-bold text-gray-400 mb-2">Privacy Note</h4>
                    <p>Your API keys are stored exclusively in your browser's local storage. They are never sent to any server other than the respective API provider (Google or OpenRouter) directly from your browser.</p>
                </section>
            </div>
        </div>
    );
};