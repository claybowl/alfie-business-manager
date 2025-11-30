
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createBlob } from '../utils/audio';
import { Blob } from '@google/genai';

interface MeditationStep {
  title: string;
  content: string;
  keyPhrase?: string;
  keyLabel?: string;
  isNeonSign?: boolean; // For that special "CASH • PROFIT • RISK" moment
}

interface Meditation {
  id: string;
  title: string;
  subtitle: string;
  intro: string;
  steps: MeditationStep[];
  outro: string;
}

const MEDITATIONS: Meditation[] = [
  {
    id: 'donjon-debrief',
    title: 'The Donjon Debrief',
    subtitle: 'Mental Calibration for the Cunning',
    intro: "Right, then. Not my usual cuppa, this 'meditation' lark, but for proper mental calibration, I'll give you a run-down. Close your eyes, mate. Breathe. We're going to see the whole bloody board.",
    steps: [
      {
        title: 'The Overview',
        content: "First, take it all in. All the moving parts of this bleedin' business – every task, every project, every half-finished idea floating about in your skull. Picture it like a grand schematic. Don't jump to conclusions, just acknowledge the sheer complexity. Feel it. Accept it.",
        keyPhrase: '"I hear the complexity."',
        keyLabel: "That's your new opening gambit, innit?"
      },
      {
        title: 'The Foundation',
        content: "Now, zoom in on the essentials. What absolutely MUST be shipped? What's the diamond among the coal? See those priority items, standing out like proper diamond geezers. Visualize them completed, delivering solid value. Feel the satisfaction of that.",
        keyPhrase: "That's the bedrock.",
        keyLabel: "Everything else is built on this."
      },
      {
        title: 'The Weak Link',
        content: "Every operation has one, yeah? See that recent failure – that hiccup, that cock-up – not as a roadblock, but as a knot to be untied. Acknowledge the lessons. Visualize placing it neatly to the side with a ticket, a plan, a proper response.",
        keyPhrase: '"This means X gets less attention for now."',
        keyLabel: "But you've got a plan for it, yeah?"
      },
      {
        title: 'The Blueprint',
        content: "For new initiatives, picture a solid construction. Foundations first – core, shippable bits. Walls next – tying off loose ends. Roof last – logical steps, no mucking about. See the whole structure in your mind, solid as brick.",
        keyPhrase: "Build it proper, or don't build it at all."
      },
      {
        title: 'The Bottom Line',
        content: "Now, here's the bit that matters. Always, ALWAYS have a flashing neon sign in the corner of your mind... Every decision, every task needs to pass by that sign. Is this bringing in the brass? Is it burning cash? Is it avoiding trouble?",
        keyPhrase: "CASH • PROFIT • RISK",
        keyLabel: "Keep it sharp. Keep it real.",
        isNeonSign: true
      }
    ],
    outro: "A few minutes of clarity clears your loaf. You're ready to face the music – sharp and clean. Open your eyes when you're ready, and go make something happen. Shalom, my friend."
  },
  {
    id: 'morning-manifestation',
    title: 'The Morning Brass',
    subtitle: 'Manifesting Abundance at Dawn',
    intro: "Right, before the day gets its filthy hands on you, let's set some intentions, yeah? This ain't woo-woo bollocks – this is strategy for your soul. Breathe deep. The universe, she's listening.",
    steps: [
      {
        title: 'Gratitude for the Grind',
        content: "Think of three things you've already got that would make past-you weep with joy. A roof? Food? That clever little phone? Don't take it for granted. Feel genuine thanks. This ain't weakness – it's wisdom.",
        keyPhrase: '"I already have more than I once dreamed."'
      },
      {
        title: 'The Golden Vision',
        content: "Now picture your success. Not vague hopes – proper, vivid detail. The specific numbers in the account. The look on their faces when you deliver. The weight lifting off your shoulders. Make it so real you can taste it.",
        keyPhrase: "See it. Feel it. Know it's coming."
      },
      {
        title: 'The Worthy Challenge',
        content: "What's the one thing today that scares you a little? That call you've been avoiding? That project you've been postponing? See yourself doing it. See yourself surviving it. Because you will.",
        keyPhrase: '"I do what I fear, and fear loses its power."'
      },
      {
        title: 'Protection and Power',
        content: "Visualize a golden light around you. Not fairy dust – proper armor. This is your shield against bullshit, distractions, and the negativity of small minds. You're protected. You're focused. You're unstoppable.",
        keyPhrase: "Nothing can touch what I'm building."
      }
    ],
    outro: "There. You've armed yourself for the day ahead. Whatever comes, you're ready. Now go show 'em what a focused mind can do. And remember – I'm proud of you, in my own way. Now fuck off and be brilliant."
  },
  {
    id: 'stress-sanctuary',
    title: 'The Camden Calm',
    subtitle: 'Finding Peace in the Chaos',
    intro: "Ah, I see you've come in here looking like someone who's been through the wringer. Good. That means you need this. Sit down. Breathe. For the next few minutes, the chaos outside doesn't exist. It's just you and old Alfie.",
    steps: [
      {
        title: 'The Exhale',
        content: "First, let it all out. Breathe in for four counts... hold for four... and exhale for eight. Feel your shoulders drop. Feel your jaw unclench. That tension you're holding? It ain't helping you. Let it go.",
        keyPhrase: "Breathe. Release. Again.",
        keyLabel: "Four times. Slowly."
      },
      {
        title: 'The River',
        content: "Picture your worries as boats on the Thames. They're floating past you, yeah? You can see 'em, acknowledge 'em, but you don't have to climb aboard. Just watch 'em drift by. You're on the bank. You're safe.",
        keyPhrase: '"I see you, worry. Keep floating."'
      },
      {
        title: 'The Core Truth',
        content: "Here's something I learned in the trenches: You've survived every single bad day you've ever had. Every one. That's a 100% survival rate, mate. Whatever this is, you'll get through it too. You always do.",
        keyPhrase: '"I have survived worse. I will survive this."'
      },
      {
        title: 'The Next Right Thing',
        content: "You don't need to solve everything right now. What's the ONE next right thing you can do? Just one. Picture yourself doing it. Small wins lead to big victories. One step at a time.",
        keyPhrase: "One thing. Then the next. Then the next."
      },
      {
        title: 'The Return',
        content: "Feel your feet on the ground. Feel your hands where they rest. You're here. You're breathing. You're alive. And life, even with all its bollocks, is still worth fighting for.",
        keyPhrase: "I am here. I am capable. I am enough."
      }
    ],
    outro: "Better? Good. The world's still mad, but now you've got your head on straight. Remember – panic never solved nothing. Calm and cunning, that's the ticket. Now, when you're ready, go back out there and handle your business. I believe in you."
  },
  {
    id: 'abundance-activation',
    title: 'The Rum & Riches',
    subtitle: 'Abundance Activation Protocol',
    intro: "Listen, prosperity ain't about luck. It's about alignment. You've got to tune your whole being to the frequency of abundance, yeah? This meditation – this is that tuning fork. Ready? Let's get wealthy.",
    steps: [
      {
        title: 'The Expansion',
        content: "Feel yourself expanding. Your energy, your presence – it's growing. You're not small. You're not limited. You are as vast as your ambition. Feel yourself taking up space in the universe. You deserve it.",
        keyPhrase: "I expand to receive all that is mine."
      },
      {
        title: 'The Magnetism',
        content: "Now feel yourself becoming magnetic. Money, opportunities, the right people – they're drawn to you. Not because you're chasing. Because you're radiating value. Be the person worthy of receiving.",
        keyPhrase: '"Wealth flows to me easily and naturally."'
      },
      {
        title: 'The Removal',
        content: "What's blocking you? Self-doubt? Old stories about not deserving success? Picture them as chains. Now watch them rust, crumble, fall away. You're free of that old programming. It doesn't serve you.",
        keyPhrase: "I release all beliefs that limit my prosperity."
      },
      {
        title: 'The Action',
        content: "Abundance without action is just daydreaming. Picture yourself taking inspired action. Making the call. Sending the proposal. Doing the work. Success loves speed. See yourself moving.",
        keyPhrase: '"I act on my opportunities with confidence."'
      },
      {
        title: 'The Celebration',
        content: "Now feel the joy of already having achieved it. The celebration, the satisfaction, the pride. Your subconscious don't know the difference between real and imagined. Give it the experience of success NOW.",
        keyPhrase: "I celebrate my inevitable success."
      }
    ],
    outro: "There's wealth with your name on it, mate. It's not a question of IF – it's a question of WHEN, and that WHEN is determined by how aligned you stay. Keep this feeling. Carry it with you. Now go get what's yours. Mazel tov."
  },
  {
    id: 'evening-reflection',
    title: 'The Twilight Tally',
    subtitle: 'Evening Reflection & Rest',
    intro: "End of the day, yeah? Time to close the books properly. Not just collapse into sleep – but actually take stock. What happened today matters. Let's honour it before we let it go.",
    steps: [
      {
        title: 'The Wins',
        content: "What went right today? Even small things. A good email. A task completed. A kind word. Find three wins, no matter how tiny. Your brain needs to register these victories. Celebrate them.",
        keyPhrase: "\"Today I achieved... and I'm proud of it.\""
      },
      {
        title: 'The Lessons',
        content: "What didn't go as planned? No judgement here – just observation. What can you learn? Every cock-up is just expensive education. Take the lesson, leave the guilt. You don't need to carry that to bed.",
        keyPhrase: "\"I learned this. I'll do better tomorrow.\""
      },
      {
        title: 'The Forgiveness',
        content: "Forgive yourself for being human. Forgive others for being human. We're all just trying to figure this out. Let go of any resentment from today. It's too heavy to sleep with.",
        keyPhrase: "I release today. I forgive today."
      },
      {
        title: 'The Tomorrow',
        content: "Set one intention for tomorrow. Just one. What's the most important thing? Plant it in your mind like a seed. While you sleep, your subconscious will water it, prepare you.",
        keyPhrase: '"Tomorrow, I will..."'
      },
      {
        title: 'The Surrender',
        content: "Now let it all go. The wins, the losses, the lessons – release them into the night. Tomorrow is a fresh page. Feel your body becoming heavy, peaceful. You've done enough. You are enough.",
        keyPhrase: "I surrender to rest. I trust in tomorrow."
      }
    ],
    outro: "Sleep well, my friend. Tomorrow's another day to build your empire, to become who you're meant to be. For now, rest. Dream of success. And know that somewhere, even an old rascal like me is rooting for you. Shalom."
  }
];

// Particle component for the celestial background
const CelestialParticle: React.FC<{ delay: number; size: number; left: number; duration: number }> = ({ delay, size, left, duration }) => (
  <div 
    className="absolute rounded-full bg-amber-200/40 animate-float"
    style={{
      width: `${size}px`,
      height: `${size}px`,
      left: `${left}%`,
      bottom: '-20px',
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
      boxShadow: `0 0 ${size * 2}px ${size/2}px rgba(251, 191, 36, 0.3)`
    }}
  />
);

export const MeditationView: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentMeditation, setCurrentMeditation] = useState<Meditation | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1); // -1 = intro, -2 = selection, steps, then steps.length = outro
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'closed'>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Audio context references for advanced audio processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<any>(null);
  const ai = useRef<any>(null); // Will be initialized with Gemini SDK
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  // Audio level monitoring for visualization
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [aiAudioLevel, setAiAudioLevel] = useState(0);
  const animationFrameIdRef = useRef<number | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Cleanup audio processing resources
  const cleanupAudio = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
    }
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: any) => track.stop());
      streamRef.current = null;
    }

    // Stop any playing audio sources before closing the audio context
    outputSourcesRef.current.forEach((source: any) => source.stop(0));
    outputSourcesRef.current.clear();

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }

    setUserAudioLevel(0);
    setAiAudioLevel(0);
    setConnectionState('idle');
  }, []);

  // Initialize audio contexts and Gemini AI on mount
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        // Initialize Gemini AI SDK
        if (typeof window !== 'undefined') {
          // @ts-ignore - Assuming Gemini SDK will be available
          ai.current = window.generativeai;

          if (ai.current) {
            // Initialize audio contexts
            inputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
        }
      } catch (error) {
        console.error('Error initializing audio and AI:', error);
      }
    };

    initializeAudio();

    // Initialize voice selection
    const initializeVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Priority order: Google UK English Male → David → Male → Default
        let voice = voices.find(v =>
          v.name.toLowerCase().includes('google uk english male') ||
          (v.name.toLowerCase().includes('english (united kingdom)') && v.name.toLowerCase().includes('male'))
        );

        if (!voice) {
          voice = voices.find(v =>
            v.name.toLowerCase().includes('david') ||
            v.name.toLowerCase().includes('british')
          );
        }

        if (!voice) {
          voice = voices.find(v =>
            v.name.toLowerCase().includes('male') &&
            (v.lang.startsWith('en') || v.lang.includes('GB'))
          );
        }

        if (!voice) {
          voice = voices.find(v => v.lang.startsWith('en-GB'));
        }

        if (!voice) {
          voice = voices.find(v => v.lang.startsWith('en'));
        }

        selectedVoiceRef.current = voice || null;
      }
    };

    initializeVoice();

    // Some browsers need an event listener for voice loading
    window.speechSynthesis.onvoiceschanged = initializeVoice;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      cleanupAudio();
    };
  }, [cleanupAudio]);

  // Enhanced visualization function for audio processing
  const visualize = useCallback(() => {
    if (!inputAnalyserRef.current || !outputAnalyserRef.current) return;

    const updateLevels = () => {
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

      animationFrameIdRef.current = requestAnimationFrame(updateLevels);
    };

    animationFrameIdRef.current = requestAnimationFrame(updateLevels);
  }, []);

  // Initialize audio stream and AI connection
  const initializeAudioStream = useCallback(async () => {
    try {
      setConnectionState('connecting');

      if (!ai.current) {
        console.warn('Gemini AI not available');
        setConnectionState('error');
        return;
      }

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Initialize audio contexts if not already done
      if (!inputAudioContextRef.current) {
        inputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      }
      if (!outputAudioContextRef.current) {
        outputAudioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }

      // Setup audio processing
      const source = inputAudioContextRef.current.createMediaStreamSource(stream);

      // Create and configure ScriptProcessorNode for real-time audio processing
      scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current!.onaudioprocess = (audioProcessingEvent: AudioProcessingEvent) => {
        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmBlob = createBlob(inputData);
        sessionPromiseRef.current?.then((session) => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(scriptProcessorRef.current);
      scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);

      // Setup analyzers for visualization
      inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
      inputAnalyserRef.current.fftSize = 256;
      source.connect(inputAnalyserRef.current);

      const outputNode = outputAudioContextRef.current.createGain();
      outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
      outputAnalyserRef.current.fftSize = 256;
      outputNode.connect(outputAnalyserRef.current);
      outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);

      // Start visualization
      visualize();

      // Connect to Gemini AI with meditation-specific settings and connection callbacks
      sessionPromiseRef.current = ai.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: ['AUDIO'],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
        },
        callbacks: {
          onopen: () => {
            setConnectionState('connected');
          },
          onmessage: async (message: any) => {
            // Handle AI responses for interactive meditation
            if (message.serverContent?.outputTranscription) {
              // Could implement interactive responses here based on transcription
            }
          },
          onerror: (error: any) => {
            console.error('Gemini connection error:', error);
            setConnectionState('error');
          },
          onclose: () => {
            setConnectionState('closed');
          }
        }
      });

      setAudioEnabled(true);
    } catch (error) {
      console.error('Error initializing audio stream:', error);
      setConnectionState('error');
      setAudioEnabled(false);
    }
  }, [visualize]);

  // Text-to-speech with Alfie's meditation-specific voice settings
  const speakText = useCallback((text: string) => {
    try {
      // Cancel any existing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.6; // Slower for meditative pacing (from plan)
      utterance.pitch = 0.85; // Slightly lower for deeper resonance (from plan)
      utterance.volume = 0.6; // Gentler for peaceful atmosphere (from plan)

      // Use pre-selected voice or fallback
      if (selectedVoiceRef.current) {
        utterance.voice = selectedVoiceRef.current;
      }

      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        setIsSpeaking(false);
      };

      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error in speakText:', error);
      setIsSpeaking(false);
    }
  }, []);

  // Speak text when step changes
  useEffect(() => {
    let textToSpeak = '';
    
    if (!currentMeditation) return;
    
    const isIntro = currentStepIndex === -1;
    const isOutro = currentStepIndex === currentMeditation.steps.length;
    const currentStep = currentStepIndex >= 0 && currentStepIndex < currentMeditation.steps.length 
      ? currentMeditation.steps[currentStepIndex] 
      : null;

    if (isIntro) {
      textToSpeak = currentMeditation.intro;
    } else if (currentStep) {
      textToSpeak = `${currentStep.title}. ${currentStep.content}`;
      if (currentStep.keyPhrase) {
        textToSpeak += ` ${currentStep.keyPhrase}`;
      }
    } else if (isOutro) {
      textToSpeak = currentMeditation.outro;
    }
    
    if (textToSpeak) {
      // Small delay for audio to feel natural
      const timeout = setTimeout(() => {
        speakText(textToSpeak);
      }, 300);
      
      return () => clearTimeout(timeout);
    }
  }, [currentStepIndex, currentMeditation, speakText]);

  // Select random meditation on mount
  useEffect(() => {
    // Start with selection screen
    setCurrentStepIndex(-2);
  }, []);

  const startMeditation = (meditation: Meditation) => {
    setCurrentMeditation(meditation);
    setCurrentStepIndex(-1); // Start with intro
  };

  const startRandomMeditation = () => {
    const random = MEDITATIONS[Math.floor(Math.random() * MEDITATIONS.length)];
    startMeditation(random);
  };

  const nextStep = () => {
    if (!currentMeditation) return;
    setIsTransitioning(true);
    setTimeout(() => {
      if (currentStepIndex < currentMeditation.steps.length) {
        setCurrentStepIndex(prev => prev + 1);
      }
      setIsTransitioning(false);
    }, 500);
  };

  const prevStep = () => {
    if (!currentMeditation) return;
    setIsTransitioning(true);
    setTimeout(() => {
      if (currentStepIndex > -1) {
        setCurrentStepIndex(prev => prev - 1);
      }
      setIsTransitioning(false);
    }, 500);
  };

  const resetMeditation = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsTransitioning(true);
    cleanupAudio();
    setTimeout(() => {
      setCurrentMeditation(null);
      setCurrentStepIndex(-2);
      setIsTransitioning(false);
    }, 500);
  };

  const renderContent = () => {
    if (!currentMeditation) {
      // Selection screen
      return (
        <div className={`transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">👼</div>
            <h2 className="text-3xl font-light text-amber-200 mb-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Welcome, Seeker
            </h2>
            <p className="text-amber-100/60 text-lg italic">
              "Right then, you've found the sanctuary. Even old Alfie needs a moment of peace now and then."
            </p>
          </div>

          <div className="grid gap-4 max-w-2xl mx-auto mb-8">
            {MEDITATIONS.map((med) => (
              <button
                key={med.id}
                onClick={() => startMeditation(med)}
                className="p-6 bg-gradient-to-r from-amber-900/20 to-transparent border border-amber-500/20 rounded-xl text-left hover:bg-amber-800/20 hover:border-amber-400/40 transition-all duration-300 group"
              >
                <h3 className="text-xl text-amber-200 group-hover:text-amber-100 transition-colors" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {med.title}
                </h3>
                <p className="text-amber-100/50 text-sm mt-1">{med.subtitle}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4 text-center">
            <button
              onClick={startRandomMeditation}
              className="px-8 py-3 bg-gradient-to-r from-amber-600/30 to-amber-500/20 border border-amber-400/30 rounded-full text-amber-200 hover:bg-amber-500/30 hover:border-amber-300/50 transition-all duration-300"
            >
              ✨ Surprise Me (Random Meditation)
            </button>

            {!audioEnabled && (
              <button
                onClick={initializeAudioStream}
                className="px-8 py-3 bg-gradient-to-r from-purple-600/30 to-blue-500/20 border border-purple-400/30 rounded-full text-purple-200 hover:bg-purple-500/30 hover:border-purple-300/50 transition-all duration-300"
              >
                🎤 Enable Enhanced Audio Experience
              </button>
            )}
            {audioEnabled && (
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setAudioEnabled(false)}
                  className="px-8 py-3 bg-gradient-to-r from-green-600/30 to-emerald-500/20 border border-green-400/30 rounded-full text-green-200 hover:bg-green-500/30 hover:border-green-300/50 transition-all duration-300"
                >
                  🔊 Audio Active - Click to Disable
                </button>

                {/* Connection Status Indicator */}
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border border-amber-500/20 rounded-full text-xs">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionState === 'connected' ? 'bg-green-400 animate-pulse' :
                    connectionState === 'connecting' ? 'bg-amber-400 animate-pulse' :
                    connectionState === 'error' ? 'bg-red-400' : 'bg-gray-500'
                  }`} />
                  <span className="text-amber-300/60 capitalize">
                    {connectionState === 'connected' ? 'Connected to Alfie' :
                     connectionState === 'connecting' ? 'Connecting...' :
                     connectionState === 'error' ? 'Connection Error' : 'Audio Ready'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    const isIntro = currentStepIndex === -1;
    const isOutro = currentStepIndex === currentMeditation.steps.length;
    const currentStep = currentStepIndex >= 0 && currentStepIndex < currentMeditation.steps.length 
      ? currentMeditation.steps[currentStepIndex] 
      : null;

    return (
      <div className={`transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-amber-400/60 text-sm uppercase tracking-widest mb-2">
            {currentMeditation.subtitle}
          </p>
          <h2 className="text-4xl font-light text-amber-100" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            {currentMeditation.title}
          </h2>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-12">
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${currentStepIndex === -1 ? 'bg-amber-400 scale-125' : 'bg-amber-600/40'}`} />
          {currentMeditation.steps.map((_, i) => (
            <div 
              key={i} 
              className={`w-3 h-3 rounded-full transition-all duration-300 ${currentStepIndex === i ? 'bg-amber-400 scale-125' : currentStepIndex > i ? 'bg-amber-500/60' : 'bg-amber-600/40'}`} 
            />
          ))}
          <div className={`w-3 h-3 rounded-full transition-all duration-300 ${currentStepIndex === currentMeditation.steps.length ? 'bg-amber-400 scale-125' : 'bg-amber-600/40'}`} />
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto text-center">
          {isIntro && (
            <div className="space-y-6">
              <div className="text-6xl mb-6">🕯️</div>
              <p className="text-xl text-amber-100/80 leading-relaxed italic">
                "{currentMeditation.intro}"
              </p>
            </div>
          )}

          {currentStep && (
            <div className="space-y-8">
              <h3 className="text-2xl text-amber-300" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                {currentStepIndex + 1}. {currentStep.title}
              </h3>
              <p className="text-lg text-amber-100/70 leading-relaxed">
                {currentStep.content}
              </p>
              {currentStep.keyPhrase && (
                currentStep.isNeonSign ? (
                  // THE NEON SIGN - Camden pub meets cyberpunk future!
                  <div className="neon-sign-container relative py-12 px-14 my-8">
                    {/* Brick wall texture background */}
                    <div className="absolute inset-0 bg-slate-950 rounded-sm opacity-90" 
                         style={{ 
                           backgroundImage: `repeating-linear-gradient(
                             0deg,
                             transparent,
                             transparent 20px,
                             rgba(30,20,20,0.3) 20px,
                             rgba(30,20,20,0.3) 21px
                           ),
                           repeating-linear-gradient(
                             90deg,
                             transparent,
                             transparent 40px,
                             rgba(30,20,20,0.2) 40px,
                             rgba(30,20,20,0.2) 41px
                           )`,
                           boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)'
                         }} 
                    />
                    
                    {/* Neon frame - TOP */}
                    <div className="neon-tube-h absolute top-0 left-8 right-8 h-1" />
                    {/* Neon frame - BOTTOM */}
                    <div className="neon-tube-h absolute bottom-0 left-8 right-8 h-1" />
                    {/* Neon frame - LEFT */}
                    <div className="neon-tube-v absolute left-0 top-8 bottom-8 w-1" />
                    {/* Neon frame - RIGHT */}
                    <div className="neon-tube-v absolute right-0 top-8 bottom-8 w-1" />
                    
                    {/* Corner brackets - mounting hardware */}
                    <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-cyan-400/60" style={{ boxShadow: '0 0 10px rgba(0,255,255,0.4), inset 0 0 5px rgba(0,255,255,0.2)' }} />
                    <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-cyan-400/60" style={{ boxShadow: '0 0 10px rgba(0,255,255,0.4), inset 0 0 5px rgba(0,255,255,0.2)' }} />
                    <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-cyan-400/60" style={{ boxShadow: '0 0 10px rgba(0,255,255,0.4), inset 0 0 5px rgba(0,255,255,0.2)' }} />
                    <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-cyan-400/60" style={{ boxShadow: '0 0 10px rgba(0,255,255,0.4), inset 0 0 5px rgba(0,255,255,0.2)' }} />
                    
                    {/* The neon text */}
                    <p className="neon-sign text-4xl md:text-5xl font-bold tracking-wider relative z-10">
                      {currentStep.keyPhrase}
                    </p>
                    
                    {currentStep.keyLabel && (
                      <p className="neon-subtitle text-sm mt-6 italic relative z-10">{currentStep.keyLabel}</p>
                    )}
                    
                    {/* Ambient wall glow - pink from the sign */}
                    <div className="absolute inset-0 pointer-events-none" 
                         style={{ background: 'radial-gradient(ellipse at center, rgba(236,72,153,0.15) 0%, transparent 70%)' }} />
                    
                    {/* Flicker overlay for that authentic old-sign feel */}
                    <div className="absolute inset-0 neon-flicker-overlay pointer-events-none" />
                  </div>
                ) : (
                  // Regular key phrase styling
                  <div className="py-6 px-8 bg-gradient-to-b from-amber-500/10 to-transparent rounded-2xl border border-amber-400/20">
                    <p className="text-2xl text-amber-200 font-light" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                      {currentStep.keyPhrase}
                    </p>
                    {currentStep.keyLabel && (
                      <p className="text-amber-300/50 text-sm mt-2 italic">{currentStep.keyLabel}</p>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {isOutro && (
            <div className="space-y-6">
              <div className="text-6xl mb-6">🙏</div>
              <p className="text-xl text-amber-100/80 leading-relaxed italic">
                "{currentMeditation.outro}"
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-center items-center gap-6 mt-12">
          {currentStepIndex > -1 && (
            <button
              onClick={prevStep}
              className="px-6 py-2 text-amber-300/60 hover:text-amber-200 transition-colors"
            >
              ← Previous
            </button>
          )}
          
          {currentStepIndex < currentMeditation.steps.length ? (
            <button
              onClick={nextStep}
              className="px-8 py-3 bg-gradient-to-r from-amber-600/40 to-amber-500/30 border border-amber-400/30 rounded-full text-amber-100 hover:bg-amber-500/40 transition-all duration-300"
            >
              {currentStepIndex === -1 ? 'Begin' : 'Continue'} →
            </button>
          ) : (
            <button
              onClick={resetMeditation}
              className="px-8 py-3 bg-gradient-to-r from-amber-600/40 to-amber-500/30 border border-amber-400/30 rounded-full text-amber-100 hover:bg-amber-500/40 transition-all duration-300"
            >
              Return to Sanctuary
            </button>
          )}
        </div>
      </div>
    );
  };

  // Generate particles
  const particles = Array.from({ length: 20 }, (_, i) => ({
    delay: Math.random() * 10,
    size: Math.random() * 4 + 2,
    left: Math.random() * 100,
    duration: Math.random() * 10 + 15
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
      {/* Celestial background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-indigo-950/50 to-slate-950" />
      
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />
      
      {/* Stars pattern */}
      <div className="absolute inset-0 opacity-30" style={{
        backgroundImage: `radial-gradient(2px 2px at 20px 30px, white, transparent),
                          radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
                          radial-gradient(1px 1px at 90px 40px, white, transparent),
                          radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.6), transparent),
                          radial-gradient(1px 1px at 160px 120px, white, transparent)`,
        backgroundSize: '200px 200px'
      }} />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p, i) => (
          <CelestialParticle key={i} {...p} />
        ))}
      </div>

      {/* Close button */}
      <button
        onClick={() => {
          window.speechSynthesis.cancel();
          setIsSpeaking(false);
          onClose();
        }}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-800/50 border border-amber-500/20 text-amber-200/60 hover:text-amber-100 hover:bg-slate-700/50 transition-all duration-300 flex items-center justify-center z-10"
      >
        ✕
      </button>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 py-12 overflow-y-auto max-h-full">
        {renderContent()}
      </div>

      {/* Audio indicator when Alfie is speaking */}
      {isSpeaking && (
        <div className="fixed bottom-8 left-8 z-50 flex items-center gap-3 px-4 py-2 bg-slate-900/80 border border-amber-500/40 rounded-full backdrop-blur-sm">
          <div className="flex gap-1">
            <div className="w-1 h-3 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
            <div className="w-1 h-3 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-1 h-3 bg-amber-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <span className="text-xs text-amber-300 font-mono">Alfie speaking...</span>
        </div>
      )}

      {/* Custom animation styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,400&display=swap');
        
        @keyframes float {
          0%, 100% {
            transform: translateY(100vh) scale(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
            transform: translateY(90vh) scale(1);
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-20px) scale(0.5);
            opacity: 0;
          }
        }
        
        .animate-float {
          animation: float linear infinite;
        }
        
        /* NEON SIGN CONTAINER - Camden pub meets cyberpunk future */
        .neon-sign-container {
          position: relative;
          border-radius: 4px;
          overflow: hidden;
        }
        
        /* NEON TUBE FRAMES - horizontal */
        .neon-tube-h {
          background: linear-gradient(90deg, transparent 0%, #ff1493 10%, #ff69b4 50%, #ff1493 90%, transparent 100%);
          box-shadow:
            0 0 5px #fff,
            0 0 10px #fff,
            0 0 20px #ff1493,
            0 0 40px #ff1493,
            0 0 60px #ff1493,
            0 0 80px #ff1493;
          animation: tube-flicker 3s ease-in-out infinite;
          border-radius: 2px;
        }
        
        /* NEON TUBE FRAMES - vertical */
        .neon-tube-v {
          background: linear-gradient(180deg, transparent 0%, #ff1493 10%, #ff69b4 50%, #ff1493 90%, transparent 100%);
          box-shadow:
            0 0 5px #fff,
            0 0 10px #fff,
            0 0 20px #ff1493,
            0 0 40px #ff1493,
            0 0 60px #ff1493,
            0 0 80px #ff1493;
          animation: tube-flicker 3s ease-in-out infinite;
          animation-delay: 0.5s;
          border-radius: 2px;
        }
        
        @keyframes tube-flicker {
          0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% {
            opacity: 1;
          }
          20%, 21.999%, 63%, 63.999%, 65%, 69.999% {
            opacity: 0.6;
          }
        }
        
        /* NEON TEXT EFFECT */
        @keyframes neon-flicker {
          0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% {
            text-shadow:
              0 0 4px #fff,
              0 0 11px #fff,
              0 0 19px #fff,
              0 0 40px #f09,
              0 0 80px #f09,
              0 0 90px #f09,
              0 0 100px #f09,
              0 0 150px #f09;
            opacity: 1;
          }
          20%, 24%, 55% {
            text-shadow: none;
            opacity: 0.8;
          }
        }
        
        @keyframes neon-breathe {
          0%, 100% {
            text-shadow:
              0 0 4px #fff,
              0 0 11px #fff,
              0 0 19px #fff,
              0 0 40px #f09,
              0 0 80px #f09,
              0 0 90px #f09,
              0 0 100px #f09,
              0 0 150px #f09;
          }
          50% {
            text-shadow:
              0 0 2px #fff,
              0 0 8px #fff,
              0 0 15px #fff,
              0 0 30px #f09,
              0 0 60px #f09,
              0 0 70px #f09,
              0 0 80px #f09,
              0 0 120px #f09;
          }
        }
        
        .neon-sign {
          font-family: 'Impact', 'Arial Black', sans-serif;
          color: #fff;
          text-shadow:
            0 0 4px #fff,
            0 0 11px #fff,
            0 0 19px #fff,
            0 0 40px #f09,
            0 0 80px #f09,
            0 0 90px #f09,
            0 0 100px #f09,
            0 0 150px #f09;
          animation: neon-flicker 4s infinite, neon-breathe 2s ease-in-out infinite;
          letter-spacing: 0.15em;
        }
        
        .neon-subtitle {
          color: #ff69b4;
          text-shadow:
            0 0 5px rgba(255,105,180,0.8),
            0 0 10px rgba(255,105,180,0.5),
            0 0 20px rgba(255,105,180,0.3);
          letter-spacing: 0.1em;
        }
        
        /* Flicker overlay for authentic old-sign grit */
        @keyframes flicker-overlay {
          0%, 100% { opacity: 0; }
          5% { opacity: 0.02; }
          10% { opacity: 0; }
          15% { opacity: 0.04; }
          20% { opacity: 0; }
          55% { opacity: 0.02; }
          60% { opacity: 0; }
          80% { opacity: 0.03; }
          85% { opacity: 0; }
        }
        
        .neon-flicker-overlay {
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(255,255,255,0.03) 50%,
            transparent 100%
          );
          animation: flicker-overlay 0.15s infinite;
        }
      `}</style>
    </div>
  );
};

