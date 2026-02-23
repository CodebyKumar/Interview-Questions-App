import React, { useState, useEffect, useRef } from "react";
import {
  Activity, Clock, ArrowRight, X, RefreshCw, AlertCircle, Square, Mic, MicOff, MessageSquare, Play, Trophy, ChevronDown,
  Calendar, CheckCircle2, ChevronRight, Layout, TrendingUp, Info
} from "lucide-react";
import questionsData from "./questions.json";

// --- TYPES ---
type Question = {
  id: string;
  role: string;
  type: string;
  question: string;
};

type Feedback = {
  mistakes: string[];
  annotatedAnswer: string;
  explanation: string;
  sampleAnswer: string;
  scores: {
    communication: number;
    structure: number;
    relevance: number;
    timing: number;
  };
};

// --- HELPERS ---

const AnnotatedAnswer = ({ text }: { text: string }) => {
  if (!text) return null;
  const parts = text.split(/(\[Comment: [^\]]+\])/);
  return (
    <div className="leading-relaxed text-[15px] text-slate-600 space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith('[Comment:')) {
          const comment = part.slice(9, -1).trim();
          return (
            <span
              key={i}
              className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-orange-50 border border-orange-200 rounded text-orange-600 text-[10px] font-medium whitespace-nowrap align-middle"
              title={comment}
            >
              <AlertCircle className="w-3 h-3" />
              {comment}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

// --- GAUGE COMPONENT ---
// --- GAUGE COMPONENT ---
const GaugeChart = ({ score, percentageAbove = 13 }: { score: number, percentageAbove?: number }) => {
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  // Fix math: offset 0 is 100%, offset C/2 is 0%.
  const strokeDashoffset = (circumference / 2) * (1 - score / 100);

  return (
    <div className="relative flex flex-col items-center justify-center pt-6">
      <div className="relative w-[240px] h-[140px] overflow-hidden flex items-end justify-center">
        {/* Semicircle Track */}
        <svg className="absolute bottom-0 w-[240px] h-[240px] -rotate-180" viewBox="0 0 160 160">
          <circle
            className="text-slate-100"
            strokeWidth={stroke}
            stroke="currentColor"
            fill="transparent"
            r={normalizedRadius}
            cx="80"
            cy="80"
            strokeDasharray={`${circumference / 2} ${circumference}`}
          />
          {/* Active Gradient Semicircle */}
          <circle
            className="transition-all duration-1000 ease-out"
            strokeWidth={stroke}
            stroke="url(#gaugeGradient)"
            strokeDasharray={`${circumference / 2} ${circumference}`}
            style={{ strokeDashoffset }}
            strokeLinecap="round"
            fill="transparent"
            r={normalizedRadius}
            cx="80"
            cy="80"
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF8A00" />
              <stop offset="50%" stopColor="#FF0000" />
              <stop offset="100%" stopColor="#FF005C" />
            </linearGradient>
          </defs>
        </svg>

        {/* Score Display */}
        <div className="relative z-10 flex flex-col items-center mb-2">
          <div className="flex items-baseline gap-0.5">
            <span className="text-5xl font-light text-slate-800">{score}</span>
            <span className="text-xl font-medium text-slate-400">/100</span>
          </div>
          <div className="mt-2 bg-green-50 text-green-600 px-3 py-1 rounded-full text-[12px] font-medium border border-green-100 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            {Math.round(score * 0.8 + 5)}% above average
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

export const App = () => {
  const [step, setStep] = useState<'selection' | 'practice' | 'analysis'>('selection');
  const [selectedRole, setSelectedRole] = useState<string>('Frontend Engineer');
  const [selectedType, setSelectedType] = useState<string>('All Types');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [timeLimit, setTimeLimit] = useState<number>(60);
  const [answerText, setAnswerText] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [analysis, setAnalysis] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'Analysis' | 'Improvement' | 'Transcript'>('Analysis');
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const roles = ["Frontend Engineer", "Backend Engineer", "Full Stack Developer", "Data/ML Engineer", "Product Manager", "Any Role"];
  const types = ["All Types", ...new Set(questionsData.map(q => q.type))];

  const filteredQuestions = questionsData.filter(q => {
    const roleMatch = selectedRole === 'Any Role' ? true : (q.role === selectedRole || q.role === 'Any Role');
    const typeMatch = selectedType === 'All Types' ? true : (q.type === selectedType);
    return roleMatch && typeMatch;
  });

  // Clear selection if it's no longer in filtered list
  useEffect(() => {
    if (selectedQuestion && !filteredQuestions.some(q => q.id === selectedQuestion.id)) {
      setSelectedQuestion(null);
    }
  }, [selectedRole, selectedType]);

  useEffect(() => {
    let interval: any = null;
    if (isRecording && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isRecording) {
      stopPractice();
    }
    return () => interval && clearInterval(interval);
  }, [isRecording, timeLeft]);

  const startPractice = () => {
    if (!selectedQuestion) return;
    setStep('practice');
    setTimeLeft(timeLimit);
    setAnswerText('');
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => event.data.size > 0 && audioChunksRef.current.push(event.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`[Recording] Stopped. Blob size: ${audioBlob.size} bytes`);
        handleTranscription(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording Error:", err);
      alert("Microphone access required for voice practice. Please check your browser permissions.");
    }
  };

  const stopPractice = () => {
    if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleTranscription = async (blob: Blob) => {
    setIsTranscribing(true);
    setLoading(true);
    const formData = new FormData();
    formData.append("audio", blob, "answer.webm");
    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transcription failed.");
      }
      const data = await res.json();
      if (data.text) {
        setAnswerText(data.text);
        await handleAnalyze(data.text);
      } else {
        throw new Error("No text returned from transcription.");
      }
    } catch (err: any) {
      console.error("Transcription Error:", err);
      alert(err.message || "Transcription failed. You can still type your answer.");
      setLoading(false);
      setStep('practice');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleAnalyze = async (textToAnalyze: string) => {
    setLoading(true);
    setStep('analysis');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: selectedQuestion?.question,
          answer: textToAnalyze || answerText,
          role: selectedRole,
          timeLimit,
          remainingTime: timeLeft
        })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.feedback?.explanation || "Analysis failed.");
      }
      const data = await response.json();
      setAnalysis(data.feedback);
    } catch (error: any) {
      console.error("Analysis Error:", error);
      alert(error.message || "Failed to analyze response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const today = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

  return (
    <div className="min-h-screen w-full bg-[#f1f3f6] text-slate-800 font-sans selection:bg-orange-100">
      <div className="relative max-w-md mx-auto min-h-screen bg-white shadow-2xl flex flex-col overflow-hidden pb-10">

        {/* Header - Report Style */}
        <header className="p-8 pb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[12px] font-medium text-slate-400 tabular-nums">{currentTime}</span>
            <div className="flex gap-1.5 opacity-60 scale-75">
              <div className="w-1.5 h-3 bg-slate-800 rounded-px" />
              <div className="w-1.5 h-2.5 bg-slate-800 rounded-px" />
              <div className="w-1.5 h-2 bg-slate-800 rounded-px" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <h1 className="text-[32px] font-serif font-light tracking-tight text-[#1e293b]">InterviewAI Master</h1>
            {step !== 'selection' && (
              <button
                onClick={() => setStep('selection')}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-[14px] text-slate-500 font-light">
            <div className="flex items-center gap-2">
              <span className="opacity-70">{selectedRole}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 opacity-70" />
              <span className="opacity-70">{today}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-8 flex flex-col">
          {step === 'selection' && (
            <div className="space-y-6 flex-1 flex flex-col pt-4 animate-in slide-in-from-bottom-5 duration-700">
              <div className="flex flex-col gap-3">
                <div className="bg-white rounded-3xl p-1 gap-2 border border-slate-100 shadow-sm flex items-center">
                  <div className="pl-6 text-slate-300"><Layout className="w-5 h-5" /></div>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="flex-1 bg-transparent py-4 text-[15px] font-medium outline-none appearance-none cursor-pointer"
                  >
                    {roles.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <div className="px-6 flex items-center justify-center border-l border-slate-100">
                    <ChevronDown className="w-5 h-5 text-slate-300" />
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-1 gap-2 border border-slate-100 shadow-sm flex items-center">
                  <div className="pl-6 text-slate-300"><Info className="w-5 h-5" /></div>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="flex-1 bg-transparent py-4 text-[15px] font-medium outline-none appearance-none cursor-pointer"
                  >
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <div className="px-6 flex items-center justify-center border-l border-slate-100">
                    <ChevronDown className="w-5 h-5 text-slate-300" />
                  </div>
                </div>

                {/* Time Selection - Moved Up */}
                <div className="bg-slate-50 rounded-[28px] p-1 flex gap-1 border border-slate-100">
                  {[30, 60, 120].map(t => (
                    <button key={t} onClick={() => setTimeLimit(t)} className={`flex-1 py-3 px-1 rounded-2xl text-[12px] font-medium transition-all ${timeLimit === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      {t}s Limit
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar pb-32">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">Challenges ({filteredQuestions.length})</span>
                </div>

                {filteredQuestions.length > 0 ? (
                  filteredQuestions.map(q => (
                    <button
                      key={q.id}
                      onClick={() => setSelectedQuestion(q)}
                      className={`group w-full p-6 text-left rounded-[28px] border transition-all duration-300 ${selectedQuestion?.id === q.id
                        ? 'border-orange-500 bg-orange-50/20 shadow-lg shadow-orange-500/5'
                        : 'border-slate-100 hover:border-slate-200 bg-white'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-medium text-slate-400 uppercase">{q.type}</span>
                        {selectedQuestion?.id === q.id && <div className="w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(255,77,0,0.5)]" />}
                      </div>
                      <p className={`text-[17px] font-light leading-tight ${selectedQuestion?.id === q.id ? 'text-slate-900' : 'text-slate-600'}`}>
                        {q.question}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                    <Activity className="w-12 h-12" />
                    <p className="font-medium text-slate-500">No challenges found for this combination.</p>
                  </div>
                )}
              </div>

              {/* Start Action Bar - Simplified */}
              <div className="absolute bottom-10 left-8 right-8">
                <button
                  disabled={!selectedQuestion}
                  onClick={startPractice}
                  className="w-full bg-[#FF4D00] hover:bg-[#e64500] text-white py-6 rounded-3xl font-medium text-[16px] disabled:opacity-20 transition-all active:scale-95 shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3"
                >
                  Start Practice Session
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {step === 'practice' && (
            <div className="flex-1 flex flex-col pt-6 animate-in fade-in duration-500 pb-20 overflow-y-auto no-scrollbar">
              <div className="flex items-center gap-3 mb-8 px-2">
                <div className="bg-orange-500 w-1.5 h-8 rounded-full" />
                <h2 className="text-xl font-light tracking-tight text-slate-900 leading-tight">
                  {selectedQuestion?.question}
                </h2>
              </div>

              <div className="flex-1 flex flex-col items-center justify-around">
                <div className="relative w-56 h-56 flex flex-col items-center justify-center mb-10">
                  <div className={`absolute inset-0 rounded-full blur-[80px] transition-all duration-1000 ${isRecording ? 'bg-orange-500/20 animate-pulse' : 'bg-slate-100/50'}`} />
                  <svg className="w-full h-full relative z-10" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="48" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                    <circle
                      cx="50" cy="50" r="48" fill="none"
                      stroke="#FF4D00" strokeWidth="4"
                      strokeDasharray="301.6"
                      strokeDashoffset={301.6 - (301.6 * timeLeft / timeLimit)}
                      strokeLinecap="round" transform="rotate(-90 50 50)"
                      className="transition-all duration-1000 linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <span className="text-[12px] font-medium text-slate-400 uppercase tracking-widest mb-1">Time Left</span>
                    <span className={`text-7xl font-light tabular-nums tracking-tighter ${timeLeft < 10 && timeLeft > 0 ? 'text-orange-500 animate-pulse' : 'text-slate-800'}`}>
                      {timeLeft}
                    </span>
                  </div>
                </div>

                <div className="w-full space-y-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-center flex-col items-center gap-4">
                      <button
                        onClick={isRecording ? stopPractice : startRecording}
                        disabled={isTranscribing}
                        className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-95 disabled:opacity-20 ${isRecording ? 'bg-white border-4 border-orange-500 text-orange-500' : 'bg-[#FF4D00] text-white'
                          }`}
                      >
                        {isRecording ? <Square className="w-8 h-8 fill-orange-500" /> : <Mic className="w-10 h-10" />}
                      </button>
                      <span className="text-[12px] font-medium text-slate-400 uppercase tracking-widest animate-pulse">
                        {isRecording ? "Recording Answer..." : isTranscribing ? "Transcribing Voice..." : "Tap to Speak"}
                      </span>
                    </div>

                    <div className="relative group p-0.5">
                      <div className="absolute top-4 right-4 z-10">
                        {answerText && (
                          <button onClick={() => setAnswerText('')} className="p-2 bg-slate-200/50 hover:bg-slate-200 rounded-full transition-all">
                            <RefreshCw className="w-4 h-4 text-slate-500" />
                          </button>
                        )}
                      </div>
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Or draft your response here..."
                        className="w-full h-40 bg-slate-50 border border-slate-100 rounded-[32px] p-6 pr-14 text-slate-700 text-base font-medium placeholder:text-slate-300 focus:outline-none focus:bg-white focus:border-orange-500/30 transition-all resize-none shadow-inner"
                      />
                    </div>

                    <button
                      onClick={() => handleAnalyze(answerText)}
                      disabled={isTranscribing || isRecording || !answerText.trim()}
                      className="w-full py-6 bg-slate-900 text-white rounded-[24px] font-medium text-[15px] flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.98] disabled:opacity-10"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Generating Report...
                        </div>
                      ) : (
                        <>
                          View Performance Report
                          <ArrowRight className="w-5 h-5 text-orange-500" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'analysis' && (analysis || loading) && (
            <div className="flex-1 flex flex-col pt-2 animate-in slide-in-from-bottom-5 duration-700 pb-10 overflow-y-auto no-scrollbar">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-8">
                  <div className="relative w-24 h-24">
                    <div className="absolute inset-0 border-4 border-slate-50 rounded-full" />
                    <div className="absolute inset-0 border-t-4 border-orange-500 rounded-full animate-spin" />
                  </div>
                  <div className="text-center space-y-1 px-8">
                    <h3 className="text-2xl font-serif font-light text-slate-800">Analyzing Performance</h3>
                    <p className="text-[12px] font-medium text-slate-400 uppercase tracking-widest animate-pulse">Generating detailed feedback...</p>
                  </div>
                </div>
              ) : analysis && (
                <div className="space-y-6">
                  {/* Score Card Section */}
                  <div className="bg-white border border-slate-50 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] rounded-[40px] p-8 pb-10">
                    <GaugeChart score={Math.round((analysis.scores.communication + analysis.scores.structure + analysis.scores.relevance + analysis.scores.timing) / 4)} />

                    <div className="grid grid-cols-2 gap-y-6 gap-x-12 mt-10">
                      {Object.entries(analysis.scores).map(([key, score]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[13px] font-medium text-slate-400 capitalize">{key}</span>
                            <span className="text-[15px] font-medium">{score}</span>
                          </div>
                          <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full" style={{ width: `${score}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tab Navigation */}
                  <div className="bg-slate-100 rounded-2xl p-1 flex font-medium text-[14px]">
                    {['Analysis', 'Improvement', 'Transcript'].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-3 px-2 rounded-xl transition-all duration-300 ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* Content Section */}
                  <div className="bg-white border border-slate-100 rounded-[32px] p-8 min-h-[300px]">
                    {activeTab === 'Analysis' && (
                      <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex items-center gap-2 mb-2">
                          <Info className="w-5 h-5 text-blue-500" />
                          <h4 className="text-[14px] font-medium uppercase text-slate-800">Executive Summary</h4>
                        </div>
                        <p className="text-[17px] font-medium leading-relaxed text-slate-600">
                          {analysis.explanation}
                        </p>
                      </div>
                    )}

                    {activeTab === 'Improvement' && (
                      <div className="space-y-8 animate-in fade-in duration-500">
                        <div>
                          <div className="flex items-center gap-2 text-rose-500 mb-4">
                            <div className="p-2 bg-rose-50 rounded-lg"><TrendingUp className="w-4 h-4 transform rotate-180" /></div>
                            <h4 className="text-[14px] font-medium uppercase">Areas for Improvement</h4>
                          </div>
                          <ul className="space-y-3">
                            {analysis.mistakes.map((m, i) => (
                              <li key={i} className="flex gap-3 text-[15px] text-slate-600 font-medium">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-2 flex-shrink-0" />
                                {m}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="pt-2">
                          <div className="flex items-center gap-2 text-emerald-500 mb-4">
                            <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle2 className="w-4 h-4" /></div>
                            <h4 className="text-[14px] font-medium uppercase">Suggested Approach</h4>
                          </div>
                          <p className="text-[15px] font-medium text-slate-800 leading-relaxed bg-[#f8fafc] p-6 rounded-3xl border border-slate-100">
                            {analysis.sampleAnswer}
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === 'Transcript' && (
                      <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[14px] font-medium uppercase text-slate-800">Your Answer</h4>
                          <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 uppercase tracking-widest">Annotated</span>
                        </div>
                        <AnnotatedAnswer text={analysis.annotatedAnswer} />
                      </div>
                    )}
                  </div>

                  {/* Footer Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep('selection')}
                      className="flex-1 bg-slate-900 text-white rounded-2xl py-5 font-medium text-[13px] tracking-tight hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      Try New Role
                    </button>
                    <button
                      onClick={startPractice}
                      className="flex-1 bg-[#FF4D00] text-white rounded-2xl py-5 font-medium text-[13px] tracking-tight hover:bg-[#e64500] transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl shadow-orange-500/20"
                    >
                      Practice Again
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
