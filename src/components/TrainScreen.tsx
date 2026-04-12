import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useActivePlayer } from "@/context/ActivePlayerContext";
import AnimatedPortrait from "./AnimatedPortrait";

const suggestedPrompts = [
  "How's your confidence?",
  "What match prep?",
  "Boost morale",
  "Fan connection",
];

interface ChatMessage {
  id: number;
  from: "user" | "player";
  text: string;
}

const TrainScreen = () => {
  const { activePlayer: player } = useActivePlayer();
  const chatRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([
      {
        id: 1,
        from: "player",
        text: `Hey Coach! ${player.name} here — ${player.age} y/o ${player.position} for ${player.clubTeam}. Ready to push! 💪`,
      },
    ]);
  }, [player.id, player.name, player.age, player.position, player.clubTeam]);
  const [input, setInput] = useState("");
  const [deltas, setDeltas] = useState<Record<string, number>>({});

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: Date.now(), from: "user", text };
    const responses = [
      { text: "Thanks Coach! Confidence is rising! 🔥", delta: { confidence: 2 } },
      { text: "Exactly what I needed. Morale up! ⚡", delta: { morale: 3 } },
      { text: "I feel the fans behind me now! 🏟️", delta: { fanBond: 2 } },
      { text: "On it! Feeling sharper already! ⚽", delta: { form: 2 } },
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];
    const playerMsg: ChatMessage = { id: Date.now() + 1, from: "player", text: response.text };

    setMessages((prev) => [...prev, userMsg, playerMsg]);
    setDeltas(response.delta);
    setInput("");
    setTimeout(() => setDeltas({}), 3000);
  };

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100dvh] safe-pb-nav pt-4">
      {/* Player Header */}
      <div className="px-4 mb-3">
        <div className="glass-card-strong p-3 flex items-center gap-3">
          <AnimatedPortrait player={player} size="md" showMood />
          <div className="flex-1">
            <p className="text-sm font-black text-foreground truncate">{player.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {player.position} · {player.representedCountry}
            </p>
            <p className="text-[9px] text-muted-foreground/80 truncate mt-0.5">{player.clubTeam}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-primary font-black uppercase tracking-wider">Training</span>
            {Object.entries(deltas).map(([key, val]) => (
              <span key={key} className="text-xs font-black text-primary animate-fade-in-up">
                +{val} {key === "fanBond" ? "Bond" : key}
              </span>
            ))}
          </div>
        </div>

        {/* Mini stat bars */}
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {Object.entries(player.attributes).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="h-1 bg-muted rounded-full overflow-hidden mb-1">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-700" style={{ width: `${value}%` }} />
              </div>
              <span className="text-[8px] text-muted-foreground uppercase font-medium">
                {key === "fanBond" ? "Bond" : key.slice(0, 4)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"} animate-fade-in-up`}>
            <div className={`max-w-[80%] px-4 py-3 text-sm ${
              msg.from === "user"
                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-lg"
                : "glass-card rounded-2xl rounded-bl-lg text-foreground"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Prompts */}
      <div className="px-4 py-2.5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => sendMessage(prompt)}
              className="shrink-0 px-3.5 py-2 rounded-xl glass-card text-foreground/80 text-xs font-semibold transition-all active:scale-95 border border-border/30"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-2">
        <div className="glass-card-strong p-2 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Talk to your player..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-3 py-1"
          />
          <button
            onClick={() => sendMessage(input)}
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center floating-button"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainScreen;
