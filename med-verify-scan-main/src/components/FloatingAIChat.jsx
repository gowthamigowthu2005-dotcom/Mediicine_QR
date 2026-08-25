import { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  Bot, Send, X, Minimize2, Maximize2, Sparkles,
  Pill, AlertTriangle, RefreshCw, ChevronDown
} from "lucide-react";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `You are MedBot, an expert AI medicine assistant for MedVerify — a medicine QR code verification platform in India.

Your expertise includes:
- Medicine information (dosage, side effects, uses, contraindications)
- QR code verification guidance
- Medicine safety and counterfeit detection tips
- Drug interactions and warnings
- Advice on when to see a doctor
- Indian medicines and brands

Rules:
- Always recommend consulting a doctor for diagnosis/treatment
- Keep responses concise and helpful (2-4 sentences max unless detail is needed)
- Use simple language, avoid heavy jargon
- Add a ⚠️ warning for serious symptoms
- Format medicine info clearly with bullet points
- Never prescribe — only inform
- If asked about non-medicine topics, politely redirect

Response style: Friendly, professional, concise.`;

const QUICK_QUESTIONS = [
  "What is Paracetamol used for?",
  "Side effects of Amoxicillin?",
  "How to verify medicine QR?",
  "Signs of counterfeit medicine?",
  "Metformin dosage info",
];

const LOCAL_FALLBACK = (msg) => {
  const q = msg.toLowerCase();
  if (q.includes("paracetamol") || q.includes("crocin") || q.includes("fever"))
    return "**Paracetamol** is used for fever and mild to moderate pain relief.\n- Usual dose: 500mg–1g every 4–6 hours\n- Max: 4g/day\n- ⚠️ Avoid alcohol; overdose causes liver damage.";
  if (q.includes("amoxicillin") || q.includes("antibiotic"))
    return "**Amoxicillin** is a broad-spectrum antibiotic for bacterial infections.\n- Typical dose: 250–500mg every 8 hours\n- Complete the full course\n- ⚠️ Can cause allergic reactions — stop if rash appears.";
  if (q.includes("ibuprofen"))
    return "**Ibuprofen** is an NSAID for pain, fever and inflammation.\n- Usual dose: 400mg every 6–8 hours with food\n- ⚠️ Avoid if you have stomach ulcers or kidney issues.";
  if (q.includes("qr") || q.includes("verify") || q.includes("scan"))
    return "To verify a medicine QR code on MedVerify:\n1. Log in as a user\n2. Go to 'Scan Medicine'\n3. Point camera at the QR code\n4. Result shows ✅ Verified, ⚠️ Expired, or ❌ Counterfeit";
  if (q.includes("counterfeit") || q.includes("fake"))
    return "Signs of counterfeit medicine:\n- Blurry/misspelled packaging\n- Missing batch/expiry info\n- QR code that fails verification\n- Unusually cheap price\n- Unusual smell, colour, or taste\n⚠️ Always buy from licensed pharmacies.";
  if (q.includes("metformin") || q.includes("diabetes"))
    return "**Metformin** is used for Type 2 Diabetes management.\n- Usual starting dose: 500mg twice daily with meals\n- Gradually increased to max 2000mg/day\n- ⚠️ Not for Type 1 diabetes or kidney disease.";
  if (q.includes("side effect"))
    return "Side effects vary by medicine. Please ask about a specific medicine (e.g., 'side effects of Ibuprofen') and I'll give you detailed information.";
  if (q.includes("hello") || q.includes("hi") || q.includes("hey"))
    return "Hello! 👋 I'm **MedBot**, your AI medicine assistant.\n\nI can help with:\n- Medicine information & dosage\n- Side effects & warnings\n- QR verification guidance\n- Drug interaction checks\n\nWhat would you like to know?";
  return "I'm here to help with medicine information, QR verification, and drug safety. Could you be more specific? For example:\n- 'What is Paracetamol used for?'\n- 'How to scan a QR code?'\n- 'Side effects of Metformin?'";
};

export default function FloatingAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "ai",
      text: "Hi! I'm **MedBot** 🤖, your AI medicine assistant.\n\nI can help with medicine info, dosage, side effects, QR verification, and counterfeit detection.\n\nWhat would you like to know?",
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(!!GEMINI_API_KEY);
  const [chatSession, setChatSession] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Init Gemini chat session
  useEffect(() => {
    if (!GEMINI_API_KEY) return;
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const chat = model.startChat({
        history: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          { role: "model", parts: [{ text: "Understood! I'm MedBot, ready to assist with medicine information and QR verification on MedVerify." }] },
        ],
      });
      setChatSession(chat);
    } catch (e) {
      console.warn("Gemini init failed:", e);
      setHasApiKey(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isOpen, isMinimized]);

  const formatText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>");
  };

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput("");

    const userMsg = { id: Date.now(), role: "user", text: userText, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      let responseText = "";

      if (hasApiKey && chatSession) {
        const result = await chatSession.sendMessage(userText);
        responseText = result.response.text();
      } else {
        // Local fallback
        await new Promise((r) => setTimeout(r, 600));
        responseText = LOCAL_FALLBACK(userText);
      }

      const aiMsg = { id: Date.now() + 1, role: "ai", text: responseText, time: new Date() };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg = {
        id: Date.now() + 1,
        role: "ai",
        text: "⚠️ Connection issue. Using offline mode:\n\n" + LOCAL_FALLBACK(userText),
        time: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now(),
      role: "ai",
      text: "Chat cleared! How can I help you? 😊",
      time: new Date(),
    }]);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center group transition-all duration-300 hover:scale-110"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)",
          }}
          title="Open MedBot AI Assistant"
        >
          <Bot className="w-6 h-6 text-white" />
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }} />
          {/* Notification dot */}
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white flex items-center justify-center">
            <span className="text-[8px] text-white font-bold">AI</span>
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl border border-white/20 overflow-hidden transition-all duration-300 ${
            isMinimized ? "w-72 h-14" : "w-96 h-[560px]"
          }`}
          style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)" }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer flex-shrink-0"
            style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-none">MedBot AI</p>
                <p className="text-white/70 text-xs">
                  {hasApiKey ? "● Gemini Powered" : "● Offline Mode"}
                </p>
              </div>
              <Sparkles className="w-3 h-3 text-yellow-300 ml-1" />
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); clearChat(); }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                title="Clear chat"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                {/* Quick questions */}
                {messages.length === 1 && (
                  <div className="space-y-1">
                    <p className="text-white/40 text-xs px-1">Quick questions:</p>
                    <div className="flex flex-wrap gap-1">
                      {QUICK_QUESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => sendMessage(q)}
                          className="text-xs px-2 py-1 rounded-full border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "ai" && (
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1"
                        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-500 text-white rounded-tr-sm"
                          : "bg-white/10 text-white/90 rounded-tl-sm border border-white/10"
                      }`}
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
                        className="whitespace-pre-wrap"
                      />
                      <p className="text-[10px] opacity-40 mt-1 text-right">
                        {msg.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1 bg-green-500/30 border border-green-500/40">
                        <span className="text-[10px] text-green-300 font-bold">U</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading dots */}
                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-white/10 border border-white/10 px-4 py-3 rounded-2xl rounded-tl-sm">
                      <div className="flex gap-1 items-center">
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Disclaimer */}
              {!hasApiKey && (
                <div className="px-3 py-1.5 bg-yellow-500/10 border-t border-yellow-500/20 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                  <p className="text-[10px] text-yellow-300">
                    Offline mode — add VITE_GEMINI_API_KEY for full AI
                  </p>
                </div>
              )}

              {/* Input */}
              <div className="flex gap-2 p-3 border-t border-white/10 flex-shrink-0">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about any medicine..."
                  disabled={loading}
                  className="flex-1 bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/40 transition-all"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={loading || !input.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Footer */}
              <div className="px-3 pb-2 text-center">
                <p className="text-[9px] text-white/20">
                  ⚕️ For informational purposes only — not medical advice
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
