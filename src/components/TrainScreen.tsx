import { useState } from "react";
import { Send } from "lucide-react";
import { mockPlayers } from "@/data/mockData";

const suggestedPrompts = [
  "How's your confidence today?",
  "What match are you preparing for?",
  "Tell me about your training goals",
  "How can I help boost your morale?",
];

interface ChatMessage {
  id: number;
  from: "user" | "player";
  text: string;
}

const TrainScreen = () => {
  const player = mockPlayers[0];
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, from: "player", text: `Hey Coach! I'm feeling great today. Ready to train! 💪` },
  ]);
  const [input, setInput] = useState("");
  const [deltas, setDeltas] = useState<Record<string, number>>({});

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: Date.now(), from: "user", text };
    const responses = [
      { text: "Thanks for the motivation, Coach! I can feel my confidence growing! 🔥", delta: { confidence: 2 } },
      { text: "That's exactly what I needed to hear. My morale is up! ⚡", delta: { morale: 3 } },
      { text: "Great advice! I feel more connected with the fans now. 🏟️", delta: { fanBond: 2 } },
      { text: "I'll focus on that in training today. Feeling sharper already! ⚽", delta: { form: 2 } },
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];
    const playerMsg: ChatMessage = { id: Date.now() + 1, from: "player", text: response.text };

    setMessages((prev) => [...prev, userMsg, playerMsg]);
    setDeltas(response.delta);
    setInput("");
    setTimeout(() => setDeltas({}), 3000);
  };

  return (
    <div className="flex flex-col h-screen pb-20 pt-6">
      {/* Header */}
      <div className="px-4 mb-4">
        <h1 className="text-2xl font-black text-foreground">Train</h1>
        <p className="text-sm text-muted-foreground">Chat with {player.name}</p>
      </div>

      {/* Player Status Card */}
      <div className="px-4 mb-4">
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-lg font-black text-background">
              {player.overall}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">{player.name}</p>
              <p className="text-xs text-muted-foreground">{player.country} {player.position}</p>
            </div>
            <div className="text-xs text-primary font-semibold px-3 py-1 rounded-full bg-primary/10">
              Cultivating
            </div>
          </div>

          {/* Attributes */}
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(player.attributes).map(([key, value]) => {
              const label = key === "fanBond" ? "Fan Bond" : key.charAt(0).toUpperCase() + key.slice(1);
              const delta = deltas[key];
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground capitalize">{label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-foreground">{value}</span>
                      {delta && (
                        <span className="text-[10px] font-bold text-primary animate-fade-in">+{delta}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                msg.from === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "glass-card rounded-bl-md text-foreground"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested Prompts */}
      <div className="px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          {suggestedPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => sendMessage(prompt)}
              className="shrink-0 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-medium transition-all active:scale-95"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-2">
        <div className="glass-card p-2 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Talk to your player..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-2"
          />
          <button
            onClick={() => sendMessage(input)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center floating-button"
          >
            <Send className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainScreen;
