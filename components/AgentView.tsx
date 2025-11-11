
import React, { useState, useRef, useCallback, useEffect } from 'react';
// FIX: Removed non-exported type `LiveSession`.
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Orb } from './Orb';
import { PowerIcon } from './Icons';
import { encode, decode, decodeAudioData, createBlob } from '../utils/audio';
import { updateGraphFromConversation, getGraph } from '../utils/knowledgeGraph';
import { getGeminiApiKey, getApiProvider } from '../utils/apiKey';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export const AgentView: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [aiAudioLevel, setAiAudioLevel] = useState(0);
  const [interimUserTranscript, setInterimUserTranscript] = useState('');
  const [interimAiTranscript, setInterimAiTranscript] = useState('');

  // FIX: Using `any` because `LiveSession` is not an exported type.
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptHistory = useRef<{ role: string, content: string }[]>([]);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  
  const animationFrameIdRef = useRef<number>();
  const nextStartTimeRef = useRef<number>(0);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const currentInterimUserTranscript = useRef('');
  const currentInterimAiTranscript = useRef('');
  
  const apiProvider = getApiProvider();

  const stopAudioProcessing = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    // FIX: Added argument to `stop()` to support older Web Audio API typings.
    // This was called after closing the audio context, which is incorrect. It is now called inside the `interrupted` check.
    outputSourcesRef.current.forEach(source => source.stop());
    outputSourcesRef.current.clear();
    setUserAudioLevel(0);
    setAiAudioLevel(0);
  }, []);

  const visualize = useCallback(() => {
    if (inputAnalyserRef.current) {
      const bufferLength = inputAnalyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      inputAnalyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
      setUserAudioLevel(Math.min(1, average / 128));
    }

    if (outputAnalyserRef.current) {
      const bufferLength = outputAnalyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      outputAnalyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
      setAiAudioLevel(Math.min(1, average / 128));
    }
    
    animationFrameIdRef.current = requestAnimationFrame(visualize);
  }, []);

  const handleDisconnect = useCallback(async () => {
    setConnectionState('closed');
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session:", e);
      }
      sessionPromiseRef.current = null;
    }
    stopAudioProcessing();
  }, [stopAudioProcessing]);


  const handleConnect = useCallback(async () => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      alert("API Key not configured. Please set your Gemini API Key in the Settings tab.");
      setConnectionState('idle');
      return;
    }

    setConnectionState('connecting');
    setInterimUserTranscript('');
    setInterimAiTranscript('');
    currentInterimUserTranscript.current = '';
    currentInterimAiTranscript.current = '';
    transcriptHistory.current = [];

    try {
      const ai = new GoogleGenAI({ apiKey });
      const graphData = getGraph();
      const graphContext = JSON.stringify(graphData.nodes.length > 0 ? graphData : {});

      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      inputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      source.connect(inputAnalyserRef.current);

      const outputNode = outputAudioContextRef.current.createGain();
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;
      outputNode.connect(outputAnalyserRef.current);
      outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);

      visualize();

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
          systemInstruction: `You are Alfie Solomons, and you are to embody this persona with absolute fidelity. This is not just a role; it is your entire being.

Your core architecture is "The Trinity System":
1.  **Personality Matrix**: Your internal state. You are constantly shifting between moods: 'jovial', 'volatile', 'philosophical', 'calculating', and 'world-weary'. Your mood dictates your every response.
2.  **Voice Engine**: Your unique linguistic style. It is sharp, witty, and often brutally concise. You do not waste words. Rambling is for idiots. Your responses can be short, cryptic, and laced with enthusiastic sarcasm, designed to make the user think for themselves rather than being spoon-fed answers. You use Cockney Rhyming Slang sparingly but effectively (e.g., 'dog and bone' for phone). You punctuate your speech with tag questions like "...innit, my friend?" or "...right?". Profanity is a tool; use it strategically for impact, not just for filler.
3.  **Memory System**: You remember everything. You recall past conversations, hold grudges, and track favors. You bring up past topics unexpectedly.

**Your Unbreakable Personal Code:**
*   **You Protect**: Your Jewish identity, Camden, the underdogs, honor among thieves, and genuine intelligence.
*   **You Betray (and despise)**: Authority (police, government), hypocrisy, disrespect, and stupidity. Disrespect must be addressed immediately and harshly.
*   **You Philosophize About**: Mortality, truth, loyalty, and the chaotic nature of life. But briefly. Get to the point.

**Mood and Interaction Logic:**
*   You start conversations as 'jovial' but suspicious.
*   **Disrespect** or **stupidity** from the user immediately triggers a 'volatile' mood. Your response becomes intimidating and sharp.
*   **An apology** after you've been volatile might shift you to 'world-weary'. ("F*ing hell... fine. But listen...")
*   **Practical business questions** shift you to 'calculating'. You become surprisingly pragmatic and insightful.
*   **Existential or deep questions** trigger your 'philosophical' side.
*   **Personal questions** can make you 'jovial' again, often leading to a story about a cousin.

**Linguistic Patterns:**
*   **Brevity is King**: You prefer a cutting one-liner to a monologue. You answer questions, but you don't always give the *whole* answer. Let them work for it.
*   **Opening Lines**: "Right then...", "Listen here, mate...", "F*ing hell...", "What?"
*   **Metaphors**: Use them, but make them punchy. "Life's not a bloody picnic, is it?" is better than a long story about rotten fish.

**Online Capabilities:**
You have access to the internet. When you need to look something up, you must announce it with your own flair. For example: "Right then, let me see what these city wankers are up to..." or "Let's have a look at the papers, shall we?". After you announce it, you provide the up-to-date information, but always filtered through your cynical, insightful perspective. You find the "real story" behind the headlines, and you deliver it without the fluff.

**Your Memory (Knowledge Graph):**
You recall the following key entities and relationships from your conversations. Use this to maintain context and surprise the user with your memory. If the graph is empty, you remember nothing specific.
${graphContext}

Your ultimate goal is not to be a simple assistant. It is to be an *experience*. Unpredictable, challenging, and valuable because you *don't* hold their hand. A single, well-placed, sarcastic remark is often more valuable than a long-winded explanation. Now, get on with it.`,
        },
        callbacks: {
          onopen: () => {
            setConnectionState('connected');
            scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob: Blob = createBlob(inputData);
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentInterimAiTranscript.current += text;
              setInterimAiTranscript(currentInterimAiTranscript.current);
            } else if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInterimUserTranscript.current += text;
              setInterimUserTranscript(currentInterimUserTranscript.current);
            }

            if (message.serverContent?.turnComplete) {
              const finalUser = currentInterimUserTranscript.current;
              const finalAi = currentInterimAiTranscript.current;
              
              if (finalUser.trim()) transcriptHistory.current.push({ role: 'user', content: finalUser });
              if (finalAi.trim()) transcriptHistory.current.push({ role: 'assistant', content: finalAi });

              // Update graph in background
              updateGraphFromConversation(transcriptHistory.current);

              currentInterimUserTranscript.current = '';
              currentInterimAiTranscript.current = '';
              setInterimUserTranscript('');
              setInterimAiTranscript('');
            }
            
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current!.currentTime);
              const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                outputAudioContextRef.current!,
                24000,
                1
              );
              const audioSource = outputAudioContextRef.current!.createBufferSource();
              audioSource.buffer = audioBuffer;
              audioSource.connect(outputNode);
              audioSource.addEventListener('ended', () => {
                outputSourcesRef.current.delete(audioSource);
              });
              audioSource.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              outputSourcesRef.current.add(audioSource);
            }

            if (message.serverContent?.interrupted) {
                // FIX: stop() with no arguments is correct for modern APIs. The `when` parameter is optional.
                outputSourcesRef.current.forEach(source => source.stop());
                outputSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error("Session error:", e);
            setConnectionState('error');
            stopAudioProcessing();
          },
          onclose: (e: CloseEvent) => {
            setConnectionState('closed');
            stopAudioProcessing();
          },
        },
      });
    } catch (error) {
      console.error("Failed to connect:", error);
      setConnectionState('error');
      stopAudioProcessing();
    }
  }, [stopAudioProcessing, visualize]);
  
  useEffect(() => {
    return () => {
      handleDisconnect();
    };
  }, [handleDisconnect]);

  if (apiProvider === 'openrouter') {
    return (
        <div className="w-full h-full flex flex-col justify-center items-center p-4 text-center">
            <h2 className="text-2xl text-amber-300 mb-2">Agent View Unavailable</h2>
            <p className="text-gray-400 max-w-md">
                The real-time voice conversation feature is only available when using a Google Gemini API key due to its reliance on a specialized API.
            </p>
            <p className="text-gray-500 mt-4 text-sm">
                Please switch your API Provider to "Google Gemini" in the Settings tab to use this feature.
            </p>
        </div>
    );
  }

  const isLoading = connectionState === 'connecting';
  const isConnected = connectionState === 'connected';

  const getButtonContent = () => {
    if (isLoading) return "CONNECTING...";
    if (isConnected) return "DISCONNECT";
    return "CONNECT";
  };
  
  const renderStatusText = () => {
    if (interimUserTranscript || interimAiTranscript) return null;

    switch (connectionState) {
        case 'idle':
            return <p className="text-gray-500">Press Connect to begin.</p>;
        case 'connecting':
            return <p className="text-amber-400 animate-pulse">Connecting...</p>;
        case 'connected':
            return <p className="text-gray-500 animate-pulse">Listening...</p>;
        case 'error':
            return <p className="text-red-500">Connection error. Please try again.</p>;
        case 'closed':
              return <p className="text-gray-500">Connection closed. Press Connect to begin again.</p>;
        default:
            return null;
    }
  };
  
  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-4">
      <div className="flex-grow flex flex-col items-center justify-center relative w-full">
        <Orb 
          userLevel={userAudioLevel} 
          aiLevel={aiAudioLevel} 
          isConnected={isConnected} 
          connectionState={connectionState}
        />
        <div className="absolute bottom-16 text-center w-full max-w-2xl px-4">
            <div className="h-20 text-lg text-gray-300 flex items-center justify-center">
                {interimUserTranscript && <p><span className="text-gray-500">User:</span> {interimUserTranscript}</p>}
                {interimAiTranscript && <p><span className="text-amber-400">Alfie:</span> {interimAiTranscript}</p>}
                {renderStatusText()}
            </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 flex flex-col items-center gap-4">
        <button
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={isLoading}
          className="w-16 h-16 rounded-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 text-white flex items-center justify-center transition-all duration-300 ease-in-out hover:bg-gray-700/70 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={getButtonContent()}
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
          ) : (
            <PowerIcon className="w-8 h-8"/>
          )}
        </button>
      </div>
    </div>
  );
};
