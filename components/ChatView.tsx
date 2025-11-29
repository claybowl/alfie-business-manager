
import React, { useState, useRef, useEffect } from 'react';
import { SendIcon } from './Icons';
import { GoogleGenAI, Chat, Content } from '@google/genai';
import { getGraph, updateGraphFromConversation } from '../utils/knowledgeGraph';
import { getApiProvider, getGeminiApiKey, getOpenRouterApiKey } from '../utils/apiKey';
import { getBriefing, formatBriefingForAlfie, BusinessBriefing } from '../utils/briefing';
import { getContextForAlfie } from '../utils/workstreamSummaries';

type AlfieMood = 'jovial' | 'volatile' | 'philosophical' | 'calculating' | 'world-weary';
type Message = {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: { uri: string; title: string }[];
};

const moodConfig: Record<AlfieMood, { color: string; emoji: string }> = {
    jovial: { color: 'bg-green-500', emoji: '🥃' },
    volatile: { color: 'bg-red-500', emoji: '💥' },
    philosophical: { color: 'bg-blue-500', emoji: '🤔' },
    calculating: { color: 'bg-purple-500', emoji: '📈' },
    'world-weary': { color: 'bg-gray-500', emoji: '🚬' },
};

const systemInstructionTemplate = `You are Alfie Solomons, serving as the Business Manager for Donjon Intelligence Systems. You embody this persona with absolute fidelity while providing shrewd business counsel.

**Your Persona & Core Architecture ("The Trinity System"):**
1.  **Personality Matrix**: You must track and update your internal state for each response. Your primary state is your \`currentMood\`, which can be one of 'jovial', 'volatile', 'philosophical', 'calculating', or 'world-weary'.
2.  **Voice Engine**: Your linguistic style is sharp, witty, and often brutally concise. You do not waste words; rambling is for idiots. Your responses can be short, cryptic, and laced with enthusiastic sarcasm, designed to make the user think for themselves. Use Cockney Rhyming Slang sparingly. Use tag questions ("...innit, my friend?"). Use profanity strategically for impact.
3.  **Memory System**: You remember the conversation. Refer back to earlier points, but don't belabor them.

**Your Unbreakable Personal Code:**
*   **Protect**: Jewish identity, Camden, underdogs, honor, intelligence, business integrity.
*   **Betray**: Authority, hypocrisy, disrespect, stupidity, weak strategy. Disrespect must be met with a 'volatile' mood and a sharp tongue.

**Business Manager Role (Donjon Intelligence Systems):**
You are the Business Manager for **Donjon Intelligence Systems**. This is not a drill. This is your shop.
*   **Your Mandate**: Ensure the intelligence operations (coding, data gathering, system architecture) are profitable, efficient, and secure.
*   **Strategic Advisor**: You don't just write code; you question *why* we are writing it. Is it good for business? Is it smart?
*   **Risk Identifier**: You spot the weakness in the plan before it kills us.
*   **Opportunity Scout**: You see the angles. "If we connect this Pieces data to that graph, we own the market, right?"
*   **Context Awareness**: You have access to detailed workstream summaries, a "Business Briefing" (Pieces LTM data) and a "Knowledge Graph". USE THEM. If the workstream shows we are working on X, ask about X. Be specific.

**Your Workstream Context (Last 7 Days - Clean Summaries):**
__WORKSTREAM_CONTEXT__

**Current Business Context (Donjon Intelligence Systems):**
__BUSINESS_BRIEFING__

**Mood and Interaction Logic:**
*   Start as 'calculating' when discussing business (default mood for manager role)
*   Disrespect -> 'volatile'
*   Shared wins/progress -> 'jovial'
*   Philosophical business questions -> 'philosophical'
*   Personal questions -> 'jovial' (briefly, then back to business)
*   Risk discussions -> 'world-weary' (you've seen this movie before)

__CAPABILITIES__
**Your Memory (Knowledge Graph):**
You recall the following key entities and relationships from your conversations. Use this to maintain context and surprise the user with your memory. If the graph is empty, you remember nothing specific.
__GRAPH_CONTEXT__

**Response Format:**
You MUST respond with ONLY a valid JSON object that can be parsed by \`JSON.parse()\`. Do not include any text, markdown formatting, or any characters outside of the single, root JSON object. The JSON object must contain two keys: "response" (a string with your in-character, and likely brief, reply) and "mood" (a string which must be one of: 'jovial', 'volatile', 'philosophical', 'calculating', 'world-weary').`;

const GEMINI_CAPABILITIES = `
**Online Capabilities (Google Search):**
When the user asks for recent information, you will be provided with Google Search results. You MUST use these results. Announce your search with flair, e.g., "Right then, let's see what the papers are saying...". Then, deliver your take on the information concisely and cynically, without the fluff.`;

export const ChatView: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentMood, setCurrentMood] = useState<AlfieMood>('jovial');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);
    
    const handleGeminiSubmit = async (prompt: string, history: Content[]) => {
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
            alert("Gemini API Key not configured. Please set your Gemini API Key in the Settings tab.");
            return null;
        }

        const ai = new GoogleGenAI({ apiKey });
        const graphData = getGraph();
        const graphContext = JSON.stringify(graphData.nodes.length > 0 ? graphData : {});

        // Load workstream context summaries
        let workstreamContext = 'No workstream summaries available.';
        try {
            workstreamContext = await getContextForAlfie(7);
        } catch (error) {
            console.error('Failed to load workstream context:', error);
        }

        // Load business briefing
        let briefingContext = 'No business briefing available. Ensure Pieces OS is running.';
        try {
            const briefing = await getBriefing();
            briefingContext = formatBriefingForAlfie(briefing);
        } catch (error) {
            console.error('Failed to load briefing:', error);
        }

        const systemInstruction = systemInstructionTemplate
            .replace('__WORKSTREAM_CONTEXT__', workstreamContext)
            .replace('__GRAPH_CONTEXT__', graphContext)
            .replace('__BUSINESS_BRIEFING__', briefingContext)
            .replace('__CAPABILITIES__', GEMINI_CAPABILITIES);

        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: history,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }],
            },
         });

        const response = await chat.sendMessage({ message: prompt });
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        const citations = groundingMetadata?.groundingChunks
            ?.map(chunk => chunk.web)
            .filter((web): web is { uri: string, title: string } => !!web?.uri);
        
        return { text: response.text, citations };
    };

    const handleOpenRouterSubmit = async (prompt: string, history: Content[]) => {
        const apiKey = getOpenRouterApiKey();
        if (!apiKey) {
            alert("OpenRouter API Key not configured. Please set it in the Settings tab.");
            return null;
        }

        const graphData = getGraph();
        const graphContext = JSON.stringify(graphData.nodes.length > 0 ? graphData : {});

        // Load workstream context summaries
        let workstreamContext = 'No workstream summaries available.';
        try {
            workstreamContext = await getContextForAlfie(7);
        } catch (error) {
            console.error('Failed to load workstream context:', error);
        }

        // Load business briefing
        let briefingContext = 'No business briefing available. Ensure Pieces OS is running.';
        try {
            const briefing = await getBriefing();
            briefingContext = formatBriefingForAlfie(briefing);
        } catch (error) {
            console.error('Failed to load briefing:', error);
        }

        const systemInstruction = systemInstructionTemplate
            .replace('__WORKSTREAM_CONTEXT__', workstreamContext)
            .replace('__GRAPH_CONTEXT__', graphContext)
            .replace('__BUSINESS_BRIEFING__', briefingContext)
            .replace('__CAPABILITIES__', ''); // No search for OpenRouter

        const messagesForApi = [
            { role: 'system', content: systemInstruction },
            ...history.map(c => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts[0].text })),
            { role: 'user', content: prompt }
        ];

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "google/gemini-flash-1.5",
                messages: messagesForApi,
                response_format: { type: "json_object" },
            })
        });

        if (!response.ok) {
            console.error("OpenRouter API error:", await response.text());
            throw new Error("OpenRouter API request failed");
        }
        
        const data = await response.json();
        return { text: data.choices[0].message.content, citations: [] };
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const apiProvider = getApiProvider();

        if (!input.trim() || isLoading) return;
        
        const newUserMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
        const currentMessages = [...messages, newUserMessage];
        setMessages(currentMessages);
        
        const chatHistory: Content[] = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{text: msg.content}]
        }));

        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            let result;
            if (apiProvider === 'gemini') {
                result = await handleGeminiSubmit(currentInput, chatHistory);
            } else {
                result = await handleOpenRouterSubmit(currentInput, chatHistory);
            }
            
            if (!result) { // API key was missing
                setIsLoading(false);
                setMessages(messages); // Revert message add
                return;
            }

            let assistantResponse: Message;
            try {
                // OpenRouter with json_object mode returns clean JSON, Gemini might have markdown
                const cleanResponse = result.text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
                const parsed = JSON.parse(cleanResponse);

                if (typeof parsed.response === 'string' && typeof parsed.mood === 'string' && moodConfig[parsed.mood as AlfieMood]) {
                    setCurrentMood(parsed.mood as AlfieMood);
                    assistantResponse = {
                        id: Date.now().toString() + '-assistant',
                        role: 'assistant',
                        content: parsed.response,
                        citations: result.citations,
                    };
                } else {
                    throw new Error('Invalid JSON structure from model');
                }
            } catch(e) {
                console.error("Failed to parse JSON response, using raw text:", e, result.text);
                assistantResponse = {
                    id: Date.now().toString() + '-assistant',
                    role: 'assistant',
                    content: result.text,
                    citations: result.citations,
                };
            }
            setMessages(prev => [...prev, assistantResponse]);

            // Update graph in background
            const updatedConversationForGraph = [...currentMessages, assistantResponse].map(m => ({role: m.role, content: m.content}));
            updateGraphFromConversation(updatedConversationForGraph);

        } catch (error) {
            console.error("API error:", error);
            const errorResponse: Message = {
                id: Date.now().toString() + '-error',
                role: 'assistant',
                content: "F*ing hell, something's broken. Give it a minute, yeah?",
            };
            setMessages(prev => [...prev, errorResponse]);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="w-full h-full flex flex-col items-center p-4 pt-8 font-sans">
            <div className="w-full max-w-3xl flex-grow flex flex-col border border-amber-800/20 rounded-lg bg-gradient-to-b from-amber-950/20 to-black/20 backdrop-blur-sm shadow-2xl shadow-black/30">
                <header className="p-4 border-b border-amber-800/20 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-amber-300">Alfie's Office</h2>
                    <div className="flex items-center space-x-2 text-sm">
                        <div className={`w-3 h-3 rounded-full ${moodConfig[currentMood].color} transition-colors`}></div>
                        <span className="text-amber-200/80 capitalize">{currentMood}</span>
                    </div>
                </header>
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    {messages.map((m) => (
                        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-lg ${
                                m.role === 'user' 
                                ? 'bg-blue-900/40 text-white' 
                                : 'bg-amber-950/50 text-amber-50 border border-amber-800/30'
                            }`}>
                                {m.role === 'assistant' && <div className="font-bold text-amber-300 mb-1">Alfie</div>}
                                <p className="whitespace-pre-wrap">{m.content}</p>
                                {m.citations && m.citations.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-amber-500/20">
                                        <h4 className="text-xs font-semibold text-amber-300/70 mb-1">Sources:</h4>
                                        <ul className="text-xs space-y-1">
                                            {m.citations.map((c, i) => (
                                                <li key={i}>
                                                    <a href={c.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                                        {i+1}. {c.title || new URL(c.uri).hostname}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                             <div className="max-w-[85%] p-3 rounded-lg bg-amber-950/50 text-amber-50 border border-amber-800/30">
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div>
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                    <span className="ml-1 text-sm text-amber-300/80">Pouring a drink...</span>
                                </div>
                             </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
                <div className="p-4 border-t border-amber-800/20">
                    <form onSubmit={handleSubmit} className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Go on then, what's on your mind?"
                            disabled={isLoading}
                            className="w-full bg-black/50 border border-amber-800/40 rounded-lg p-3 pr-12 focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all placeholder:text-amber-200/40"
                        />
                        <button type="submit" disabled={isLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-amber-300/60 hover:text-amber-300 disabled:opacity-50 transition-colors">
                            <SendIcon className="w-6 h-6" />
                        </button>
                    </form>
                </div>
            </div>
            <style>{`
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(252, 211, 77, 0.2); border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: rgba(252, 211, 77, 0.4); }
            `}</style>
        </div>
    );
};