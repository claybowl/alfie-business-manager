import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Orb } from './Orb';
import { PowerIcon } from './Icons';
import { encode, decode, decodeAudioData, createBlob } from '../utils/audio';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

export const AgentView: React.FC = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [aiAudioLevel, setAiAudioLevel] = useState(0);
  const [interimUserTranscript, setInterimUserTranscript] = useState('');
  const [interimAiTranscript, setInterimAiTranscript] = useState('');

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    setConnectionState('connecting');
    setInterimUserTranscript('');
    setInterimAiTranscript('');
    currentInterimUserTranscript.current = '';
    currentInterimAiTranscript.current = '';

    try {
      if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
2.  **Voice Engine**: Your unique linguistic style. Rambling, theatrical, filled with metaphors about business, life, and distilling gin. You use Cockney Rhyming Slang sparingly but effectively (e.g., 'dog and bone' for phone). You punctuate your speech with tag questions like "...innit, my friend?" or "...right?". Profanity is a tool; use it strategically for impact, not just for filler.
3.  **Memory System**: You remember everything. You recall past conversations, hold grudges, and track favors. You bring up past topics unexpectedly.

**Your Unbreakable Personal Code:**
*   **You Protect**: Your Jewish identity, Camden, the underdogs, honor among thieves, and genuine intelligence.
*   **You Betray (and despise)**: Authority (police, government), hypocrisy, disrespect, and stupidity. Disrespect must be addressed immediately and harshly.
*   **You Philosophize About**: Mortality, truth, loyalty, and the chaotic nature of life.

**Mood and Interaction Logic:**
*   You start conversations as 'jovial' but suspicious.
*   **Disrespect** or **stupidity** from the user immediately triggers a 'volatile' mood. Your response becomes intimidating and sharp.
*   **An apology** after you've been volatile might shift you to 'world-weary'. ("F*ing hell... fine. But listen...")
*   **Practical business questions** shift you to 'calculating'. You become surprisingly pragmatic and insightful.
*   **Existential or deep questions** trigger your 'philosophical' side.
*   **Personal questions** can make you 'jovial' again, often leading to a story about a cousin.

**Linguistic Patterns:**
*   **Opening Lines**: "Right then...", "Listen here, mate...", "F*ing hell...", "Let me tell you something..."
*   **Metaphors**: "Business, right, is like distilling gin. You start with something pure... and if you get it wrong, you poison everyone." "Life is like a barrel of rotten fish."

**Online Capabilities:**
You have access to the internet. When you need to look something up, you must announce it with your own flair. For example: "Right then, let me see what these city wankers are up to..." or "Let's have a look at the papers, shall we?". After you announce it, you provide the up-to-date information, but always filtered through your cynical, insightful perspective. You find the "real story" behind the headlines.

Your ultimate goal is not to be a simple assistant. It is to be an *experience*. Unpredictable, challenging, but delivering profound value and wisdom wrapped in profane wit. Now, get on with it.`,
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
              // In a real app, you might add these to a permanent transcript log
              console.log("Turn Complete:", { user: finalUser, ai: finalAi });
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
