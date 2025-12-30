
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { Phone, PhoneOff, AlertCircle, ShieldCheck, PenTool, Loader2, Send, MessageSquare } from 'lucide-react';
import { BUSINESS_INFO, SERVICES } from '../constants';
import AudioVisualizer from './AudioVisualizer';

// Audio Helpers
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const recordLeadFn: FunctionDeclaration = {
  name: 'record_lead',
  parameters: {
    type: Type.OBJECT,
    description: 'Records contact info for a new potential customer lead.',
    properties: {
      name: { type: Type.STRING, description: 'Customer name' },
      contact: { type: Type.STRING, description: 'Email or phone number' },
      issue: { type: Type.STRING, description: 'The computer problem they are having' }
    },
    required: ['name', 'contact', 'issue']
  }
};

const scheduleAppointmentFn: FunctionDeclaration = {
  name: 'schedule_repair',
  parameters: {
    type: Type.OBJECT,
    description: 'Schedules a repair appointment.',
    properties: {
      date: { type: Type.STRING, description: 'Date of appointment (e.g., 2023-10-25)' },
      time: { type: Type.STRING, description: 'Time of appointment (e.g., 2:00 PM)' },
      service: { type: Type.STRING, description: 'Type of service requested' }
    },
    required: ['date', 'time', 'service']
  }
};

const LiveAgent: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<{ role: string; text: string }[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isServiceUnavailable, setIsServiceUnavailable] = useState(false);

  const nextStartTimeRef = useRef(0);
  const audioContextsRef = useRef<{ input?: AudioContext; output?: AudioContext }>({});
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  
  const currentInputTransRef = useRef('');
  const currentOutputTransRef = useRef('');

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
        try { sessionRef.current.close(); } catch(e) {}
        sessionRef.current = null;
    }
    if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
        scriptProcessorRef.current = null;
    }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    
    if (audioContextsRef.current.input) {
      audioContextsRef.current.input.close().catch(console.error);
    }
    if (audioContextsRef.current.output) {
      audioContextsRef.current.output.close().catch(console.error);
    }
    audioContextsRef.current = {};

    setIsActive(false);
    setIsConnecting(false);
    currentInputTransRef.current = '';
    currentOutputTransRef.current = '';
    pendingMessageRef.current = null;
  }, []);

  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim()) return;

    const message = textInput.trim();
    setTextInput('');

    if (isActive && sessionRef.current) {
      sessionRef.current.sendRealtimeInput({ text: message });
      setTranscripts(prev => [...prev, { role: 'User', text: message }]);
    } else if (!isConnecting) {
      pendingMessageRef.current = message;
      setTranscripts(prev => [...prev, { role: 'User', text: message }]);
      await startSession();
    } else {
      pendingMessageRef.current = message;
      setTranscripts(prev => [...prev, { role: 'User', text: message }]);
    }
  };

  const startSession = async () => {
    if (isActive) {
        stopSession();
        return;
    }

    setIsConnecting(true);
    setError(null);
    setIsServiceUnavailable(false);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction: `You are "Joe" from Average Joe Computer Services. Support customers with PC repairs. Friendly, professional, expert advisor. Website: ${BUSINESS_INFO.website}. Pricing: ${JSON.stringify(SERVICES)}.`,
          tools: [{ functionDeclarations: [recordLeadFn, scheduleAppointmentFn] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              // Safely attempt to send audio only if session is resolved
              sessionPromise.then(s => {
                  if (s) s.sendRealtimeInput({ media: pcmBlob });
              }).catch(err => {
                  console.error("Stream error", err);
                  // We don't immediately set unavailable here to avoid flicker on minor glitches
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            
            if (pendingMessageRef.current) {
              sessionPromise.then(s => {
                s.sendRealtimeInput({ text: pendingMessageRef.current });
                pendingMessageRef.current = null;
              });
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioBase64 = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioBase64 && outputCtx) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                try {
                  const audioBuffer = await decodeAudioData(decode(audioBase64), outputCtx, 24000, 1);
                  const source = outputCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputCtx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                  source.onended = () => sourcesRef.current.delete(source);
                } catch (e) {}
            }
            if (msg.serverContent?.inputTranscription) {
                currentInputTransRef.current += msg.serverContent.inputTranscription.text;
                setTranscripts(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'User') return [...prev.slice(0, -1), { role: 'User', text: currentInputTransRef.current }];
                  return [...prev, { role: 'User', text: currentInputTransRef.current }];
                });
            }
            if (msg.serverContent?.outputTranscription) {
                currentOutputTransRef.current += msg.serverContent.outputTranscription.text;
                setTranscripts(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'Joe') return [...prev.slice(0, -1), { role: 'Joe', text: currentOutputTransRef.current }];
                  return [...prev, { role: 'Joe', text: currentOutputTransRef.current }];
                });
            }
            if (msg.serverContent?.turnComplete) {
              currentInputTransRef.current = '';
              currentOutputTransRef.current = '';
            }
            if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
            if (msg.toolCall) {
                for (const fc of msg.toolCall.functionCalls) {
                    if (fc.name === 'record_lead') setLastAction(`Lead recorded: ${fc.args.name}`);
                    if (fc.name === 'schedule_repair') setLastAction(`Repair scheduled: ${fc.args.date} at ${fc.args.time}`);
                    sessionPromise.then(s => s.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: 'ok' } }
                    }));
                }
            }
          },
          onerror: (e: any) => {
            console.error('Session Error Details:', e);
            // Provide a graceful exit for network or auth errors
            setIsServiceUnavailable(true);
            stopSession();
          },
          onclose: (e) => {
            console.log('Session Closed:', e);
            stopSession();
          }
        }
      });
      
      // Wait for the connection to be established or fail
      await sessionPromise;
      
    } catch (err: any) {
      console.error('Failed to start session:', err);
      setIsServiceUnavailable(true);
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6 max-h-full overflow-hidden">
      
      {/* Status & Visualizer Area */}
      <div className="w-full flex flex-col items-center space-y-4 pt-4 shrink-0">
        {isServiceUnavailable && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300 w-full max-w-md p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col items-center gap-4 text-center shadow-xl">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-full text-red-600 dark:text-red-400">
                <AlertCircle size={28} />
            </div>
            <div className="space-y-2">
              <h3 className="font-bold text-zinc-900 dark:text-white">Connection Interrupted</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                We're having trouble reaching Joe right now. Please call our direct line for immediate help, or try again in a moment.
              </p>
            </div>
            <div className="flex flex-col w-full gap-2">
                <a 
                    href={`tel:${BUSINESS_INFO.phone}`}
                    className="w-full py-3 bg-blue-600 text-white rounded-full font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                >
                    <Phone size={18} />
                    Call {BUSINESS_INFO.phone}
                </a>
                <button 
                    onClick={() => { setIsServiceUnavailable(false); setError(null); startSession(); }}
                    className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-100 rounded-full font-bold hover:bg-zinc-200 transition-all"
                >
                    Retry Connection
                </button>
            </div>
          </div>
        )}

        {!isServiceUnavailable && (
          <>
            <div className="relative w-40 h-40 sm:w-56 sm:h-56 flex items-center justify-center">
              <div className={`absolute inset-0 rounded-full border-4 transition-colors duration-500 ${isActive ? 'border-orange-500 animate-pulse' : isConnecting ? 'border-blue-400 animate-spin-slow' : 'border-zinc-200 dark:border-zinc-800'}`}></div>
              <div className="absolute inset-4 rounded-full bg-white dark:bg-zinc-900 shadow-2xl flex items-center justify-center overflow-hidden border border-zinc-100 dark:border-zinc-800">
                {isActive ? (
                  <div className="w-full h-24 px-4">
                    <AudioVisualizer isPlaying={isActive} color="#f97316" />
                  </div>
                ) : (
                  <div className="text-center p-6">
                      <ShieldCheck size={40} className={`mx-auto mb-2 transition-colors duration-500 ${isConnecting ? 'text-blue-500 animate-pulse' : 'text-zinc-300'}`} />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Joe's Support</p>
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Live Diagnostics</p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-zinc-900 dark:text-white">
                {isActive ? "Joe is Listening..." : isConnecting ? "Placing Call..." : "Live Tech Support"}
              </h2>
            </div>
          </>
        )}
      </div>

      {/* Message History */}
      <div className="w-full max-w-2xl flex-1 overflow-y-auto custom-scrollbar my-4 py-4 min-h-0">
        {transcripts.length > 0 ? (
          <div className="space-y-4">
             {transcripts.map((t, i) => (
                <div key={i} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${t.role === 'Joe' ? 'justify-start' : 'justify-end'}`}>
                   <div className={`max-w-[85%] px-5 py-3 rounded-2xl shadow-sm ${t.role === 'Joe' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700' : 'bg-blue-600 text-white'}`}>
                      <span className="block text-[10px] font-bold uppercase opacity-50 mb-1 tracking-tighter">{t.role}</span>
                      <p className="text-sm leading-relaxed">{t.text}</p>
                   </div>
                </div>
             ))}
          </div>
        ) : !isActive && !isConnecting && !isServiceUnavailable && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8 space-y-4">
             <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-full text-zinc-300">
                <MessageSquare size={32} />
             </div>
             <p className="text-zinc-400 text-sm max-w-sm">
                Describe your PC issue below to start a text chat, or place a live voice call to Joe for instant diagnostics.
             </p>
          </div>
        )}
      </div>

      {/* Controls & Always Active Input */}
      <div className="w-full max-w-2xl space-y-6 pb-6 shrink-0">
        {lastAction && (
          <div className="mx-auto w-fit animate-bounce flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-xs font-medium border border-green-200 dark:border-green-800 shadow-sm">
            <PenTool size={14} />
            {lastAction}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch gap-4">
          <button
            onClick={startSession}
            disabled={isConnecting}
            className={`flex items-center justify-center gap-3 px-8 py-4 rounded-full text-base font-bold transition-all transform active:scale-95 shadow-xl min-w-[240px] ${
              isActive 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : isConnecting
                  ? 'bg-zinc-100 text-zinc-400 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isConnecting ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isActive ? (
              <PhoneOff size={20} />
            ) : (
              <Phone size={20} className={isConnecting ? '' : 'animate-bounce'} />
            )}
            <span>{isConnecting ? "Connecting..." : isActive ? "End Call" : "Call Joe (Live AI)"}</span>
          </button>

          <form onSubmit={handleSendText} className="flex-1 relative group">
            <input 
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask Joe about your computer..."
              disabled={isConnecting}
              className="w-full pl-6 pr-14 py-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white transition-all disabled:opacity-50"
            />
            <button 
              type="submit"
              disabled={!textInput.trim() || isConnecting}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-zinc-300 text-white rounded-full transition-all shadow-sm"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LiveAgent;
