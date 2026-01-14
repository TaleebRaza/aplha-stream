import { useState, useEffect, useRef } from "react";
import {
  Activity,
  Cpu,
  Clock,
  Server,
  ShieldCheck,
  Terminal,
  Play,
  Pause,
  Layers,
  Settings,
  HelpCircle,
  X,
  BarChart3,
  LayoutGrid,
  Power,
  ChevronRight,
} from "lucide-react";

// --- Types ---
type ClientId = "APEX" | "NOVA" | "ZEUS" | "FLUX";
type ViewMode = "GRID" | "GANTT";

interface Message {
  id: string;
  clientId: ClientId;
  content: string;
  timestamp: number;
  type: "BUY" | "SELL" | "PING";
}

interface ProcessedLog extends Message {
  processedAt: number;
  latencyMs: number;
  coreId: number;
}

interface GanttBlock {
  id: string;
  clientId: ClientId;
  startTime: number;
  endTime: number;
  coreId: number;
}

// --- Constants ---
const CLIENTS: ClientId[] = ["APEX", "NOVA", "ZEUS", "FLUX"];
const INJECTION_RATE_MS = 2000;

const THEME = {
  APEX: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  NOVA: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  ZEUS: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  FLUX: "text-rose-400 border-rose-500/30 bg-rose-500/10",
};

const THEME_SOLID = {
  APEX: "bg-emerald-500",
  NOVA: "bg-cyan-500",
  ZEUS: "bg-violet-500",
  FLUX: "bg-rose-500",
};

// Themes for CPU Cores to distinguish them visually
const CORE_THEMES = [
  {
    name: "BLUE",
    border: "border-blue-500",
    text: "text-blue-400",
    bg: "bg-blue-500/20",
    badge: "bg-blue-500",
    gradient: "from-blue-500",
    shadow: "shadow-blue-500/50",
  },
  {
    name: "ORANGE",
    border: "border-orange-500",
    text: "text-orange-400",
    bg: "bg-orange-500/20",
    badge: "bg-orange-500",
    gradient: "from-orange-500",
    shadow: "shadow-orange-500/50",
  },
  {
    name: "FUCHSIA",
    border: "border-fuchsia-500",
    text: "text-fuchsia-400",
    bg: "bg-fuchsia-500/20",
    badge: "bg-fuchsia-500",
    gradient: "from-fuchsia-500",
    shadow: "shadow-fuchsia-500/50",
  },
  {
    name: "LIME",
    border: "border-lime-500",
    text: "text-lime-400",
    bg: "bg-lime-500/20",
    badge: "bg-lime-500",
    gradient: "from-lime-500",
    shadow: "shadow-lime-500/50",
  },
];

// --- Tutorial Data ---
const TUTORIAL_STEPS = [
  {
    targetId: null,
    title: "Welcome to AlphaStream",
    content:
      "This is a cinematic simulation of a Cloud-Based Message Processor. We visualize how servers handle multiple incoming streams using the 'Round Robin' scheduling algorithm.",
    position: "center",
  },
  {
    targetId: "processor-core",
    title: "Multi-Core Processing",
    content:
      "New Feature: You have configured the hardware with specific CPU cores. Each core runs its own Round Robin cycle independently. They are now color-coded to help you track their individual progress.",
    position: "left",
  },
  {
    targetId: "view-toggle",
    title: "Visualization Modes",
    content:
      "Switch between 'Queue Grid' and 'Gantt Chart'. The Gantt chart now visualizes the CPU history across all your active cores, complete with time data.",
    position: "bottom-left",
  },
  {
    targetId: "queue-grid",
    title: "The Client Queues",
    content:
      "Messages arrive here. When a CPU Core processes a queue, the entire column will light up in that Core's specific color (Blue, Orange, Fuchsia, or Lime).",
    position: "right",
  },
  {
    targetId: "controls-area",
    title: "System Controls",
    content:
      "Use 'INJECT DATA' to simulate traffic. Use the Power button (top right) to Reset the system and change the Core count.",
    position: "bottom-left",
  },
];

// --- Helper: Generate ID ---
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function AlphaStream() {
  // --- State ---
  const [configMode, setConfigMode] = useState<boolean>(true);
  const [cpuCount, setCpuCount] = useState<number>(1);

  const [queues, setQueues] = useState<Record<ClientId, Message[]>>({
    APEX: [],
    NOVA: [],
    ZEUS: [],
    FLUX: [],
  });

  const [logs, setLogs] = useState<ProcessedLog[]>([]);
  const [ganttHistory, setGanttHistory] = useState<GanttBlock[]>([]);

  // Track active client index for EACH core
  const [coreStates, setCoreStates] = useState<{ clientIndex: number }[]>([
    { clientIndex: 0 },
  ]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [autoInject, setAutoInject] = useState<boolean>(false);
  const [tickRate, setTickRate] = useState<number>(1200);
  const [viewMode, setViewMode] = useState<ViewMode>("GRID");

  // Tutorial State
  const [tutorialStep, setTutorialStep] = useState<number>(-1);
  const isTutorialActive = tutorialStep >= 0;

  // Stats
  const [metrics, setMetrics] = useState({
    totalProcessed: 0,
    avgLatency: 0,
    activeNodes: 4,
  });

  const ganttContainerRef = useRef<HTMLDivElement>(null);

  // -- Simulation Refs (Source of Truth for Interval) --
  const queuesRef = useRef(queues);
  const coreStatesRef = useRef(coreStates);

  // Sync Refs with State updates that happen outside the loop
  useEffect(() => {
    queuesRef.current = queues;
  }, [queues]);
  useEffect(() => {
    coreStatesRef.current = coreStates;
  }, [coreStates]);

  // Auto-scroll Gantt chart
  useEffect(() => {
    if (viewMode === "GANTT" && ganttContainerRef.current) {
      ganttContainerRef.current.scrollLeft =
        ganttContainerRef.current.scrollWidth;
    }
  }, [ganttHistory, viewMode]);

  // --- Logic: Initialize System ---
  const initializeSystem = (cores: number) => {
    setCpuCount(cores);
    const initialStates = Array.from({ length: cores }, (_, i) => ({
      clientIndex: i % CLIENTS.length,
    }));
    setCoreStates(initialStates);
    coreStatesRef.current = initialStates; // Force update ref immediately
    setConfigMode(false);
  };

  const resetSystem = () => {
    setIsProcessing(false);
    setAutoInject(false);
    setQueues({ APEX: [], NOVA: [], ZEUS: [], FLUX: [] });
    setLogs([]);
    setGanttHistory([]);
    setMetrics({ totalProcessed: 0, avgLatency: 0, activeNodes: 4 });
    setTutorialStep(-1);
    setConfigMode(true);
  };

  // --- Logic: Message Injection ---
  const addMessage = (clientId: ClientId) => {
    const types: ("BUY" | "SELL" | "PING")[] = ["BUY", "SELL", "PING"];
    const type = types[Math.floor(Math.random() * types.length)];
    const price = (Math.random() * 1000 + 100).toFixed(2);

    const newMessage: Message = {
      id: generateId(),
      clientId,
      content: `${type} @ ${price}`,
      timestamp: Date.now(),
      type,
    };

    setQueues((prev) => ({
      ...prev,
      [clientId]: [...prev[clientId], newMessage],
    }));
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoInject && !configMode) {
      interval = setInterval(() => {
        const randomClient =
          CLIENTS[Math.floor(Math.random() * CLIENTS.length)];
        addMessage(randomClient);
      }, INJECTION_RATE_MS);
    }
    return () => clearInterval(interval);
  }, [autoInject, configMode]);

  // --- Logic: Multi-Core Round Robin Processor ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isProcessing && !configMode) {
      interval = setInterval(() => {
        // 1. Snapshot Current Simulation State from Refs
        let currentQueues = { ...queuesRef.current };
        let currentCoreStates = [...coreStatesRef.current];
        let processedItems: ProcessedLog[] = [];
        let ganttItems: GanttBlock[] = [];
        const now = Date.now();

        // 2. Parallel Processing Loop (Simulated)
        for (let coreId = 0; coreId < cpuCount; coreId++) {
          const state = currentCoreStates[coreId];
          if (!state) continue;

          const clientId = CLIENTS[state.clientIndex];
          const clientQueue = currentQueues[clientId];

          // Check if queue has data
          if (clientQueue && clientQueue.length > 0) {
            const [msg, ...remaining] = clientQueue;
            currentQueues[clientId] = remaining;

            const latency = now - msg.timestamp;
            processedItems.push({
              ...msg,
              processedAt: now,
              latencyMs: latency,
              coreId,
            });
            ganttItems.push({
              id: generateId(),
              clientId,
              startTime: now - tickRate,
              endTime: now,
              coreId,
            });
          }

          // Move Round Robin Pointer for this core
          currentCoreStates[coreId] = {
            clientIndex: (state.clientIndex + 1) % CLIENTS.length,
          };
        }

        // 3. Update State & Refs
        queuesRef.current = currentQueues;
        coreStatesRef.current = currentCoreStates;

        setQueues(currentQueues);
        setCoreStates(currentCoreStates);

        if (processedItems.length > 0) {
          setLogs((prev) => [...processedItems, ...prev].slice(0, 50));
          setGanttHistory((prev) => [...prev, ...ganttItems].slice(-100));

          setMetrics((prev) => {
            const newTotal = prev.totalProcessed + processedItems.length;
            const batchLatency = processedItems.reduce(
              (sum, item) => sum + item.latencyMs,
              0
            );
            const newAvg = Math.floor(
              (prev.avgLatency * prev.totalProcessed + batchLatency) / newTotal
            );
            return { ...prev, totalProcessed: newTotal, avgLatency: newAvg };
          });
        }
      }, tickRate);
    }

    return () => clearInterval(interval);
  }, [isProcessing, configMode, tickRate, cpuCount]);

  // --- Tutorial Controls ---
  const nextStep = () => {
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep((prev) => prev + 1);
    } else {
      setTutorialStep(-1);
    }
  };

  const prevStep = () => {
    if (tutorialStep > 0) {
      setTutorialStep((prev) => prev - 1);
    }
  };

  const skipTutorial = () => setTutorialStep(-1);
  const startTutorial = () => setTutorialStep(0);

  const getHighlightClass = (id: string) => {
    if (!isTutorialActive) return "";
    // Safety check: ensure tutorial step exists
    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step) return "";

    const currentTarget = step.targetId;
    return currentTarget === id
      ? "z-50 relative ring-2 ring-cyan-400 ring-offset-4 ring-offset-slate-900 rounded-lg transition-all duration-300 shadow-[0_0_50px_rgba(34,211,238,0.3)] bg-slate-900/80"
      : "opacity-40 pointer-events-none filter blur-[1px]";
  };

  // Safe access for highlighting logic
  const currentStepData = isTutorialActive
    ? TUTORIAL_STEPS[tutorialStep]
    : null;
  const currentTargetId = currentStepData ? currentStepData.targetId : null;
  const isHeaderHighlighted = [
    "controls-area",
    "quantum-slider",
    "view-toggle",
  ].includes(currentTargetId || "");
  const isSidebarHighlighted = ["processor-core", "execution-logs"].includes(
    currentTargetId || ""
  );

  // --- Sub-Components ---

  const ClientColumn = ({ id }: { id: ClientId }) => {
    const activeCores = coreStates
      .map((s, idx) => ({ ...s, id: idx }))
      .filter((s) => CLIENTS[s.clientIndex] === id);
    const isTargeted = activeCores.length > 0;

    // Pick the theme of the FIRST active core processing this queue (for background color)
    const primaryCoreId = activeCores.length > 0 ? activeCores[0].id : 0;
    const coreTheme = CORE_THEMES[primaryCoreId];

    const queue = queues[id];
    const colorClass = THEME[id];

    return (
      <div
        className={`relative flex flex-col h-full border-r border-slate-800 transition-all duration-500 ${
          isTargeted
            ? `${coreTheme.bg} shadow-[inset_0_0_30px_rgba(0,0,0,0.3)]`
            : "bg-slate-950/50"
        }`}
      >
        <div
          className={`p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 z-10 ${
            isTargeted ? "bg-slate-900/80" : "bg-slate-950"
          }`}
        >
          <div>
            <div
              className={`text-xs font-bold tracking-widest ${
                isTargeted ? "text-white" : "text-slate-500"
              }`}
            >
              {id}_NODE
            </div>
            <div className="text-[10px] text-slate-600 font-mono">
              ID: {id.substring(0, 2)}-99
            </div>
          </div>
          {isTargeted ? (
            <div className="flex -space-x-1">
              {activeCores.map((c) => (
                <div
                  key={c.id}
                  className={`w-4 h-4 rounded-full ${
                    CORE_THEMES[c.id].badge
                  } border border-slate-900 flex items-center justify-center text-[8px] text-black font-bold shadow-lg transform hover:scale-110 transition-transform`}
                >
                  {c.id}
                </div>
              ))}
            </div>
          ) : (
            <div className="w-2 h-2 rounded-full bg-slate-700" />
          )}
        </div>

        <div className="flex-1 p-3 space-y-2 relative min-h-[200px]">
          {isTargeted && isProcessing && (
            <div
              className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${coreTheme.name.toLowerCase()}-500 to-transparent opacity-50 animate-[scan_1.5s_ease-in-out_infinite]`}
              style={{
                backgroundImage: `linear-gradient(90deg, transparent, ${coreTheme.gradient}, transparent)`,
              }}
            />
          )}

          {queue.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 pt-10">
              <Server size={32} className="text-slate-500 mb-2" />
              <span className="text-[10px] uppercase tracking-widest text-slate-500">
                Idle
              </span>
            </div>
          ) : (
            queue.map((msg, idx) => (
              <div
                key={msg.id}
                className={`transform transition-all duration-300 ${
                  idx === 0 && isTargeted && isProcessing
                    ? "scale-105 translate-x-1 brightness-125"
                    : "scale-100"
                } ${colorClass} border-l-2 p-3 text-xs font-mono shadow-lg mb-2 bg-opacity-10 backdrop-blur-sm`}
              >
                <div className="flex justify-between opacity-70 mb-1">
                  <span>MSG_ID_{msg.id.substring(0, 4)}</span>
                  <span>
                    {((Date.now() - msg.timestamp) / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="font-bold tracking-wider">{msg.content}</div>
              </div>
            ))
          )}
        </div>

        <div className="p-2 bg-slate-950 border-t border-slate-800 text-center sticky bottom-0 z-10">
          <span className="text-[10px] text-slate-500 uppercase">Load: </span>
          <span
            className={`font-mono ${
              queue.length > 5 ? "text-red-500" : "text-slate-400"
            }`}
          >
            {queue.length}
          </span>
        </div>
      </div>
    );
  };

  const GanttPanel = () => {
    return (
      <div className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
        <div
          className="absolute inset-0 z-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, #334155 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        ></div>

        <div className="flex-1 flex items-stretch z-10 overflow-hidden relative p-4">
          <div className="w-24 flex flex-col border-r border-slate-800 pr-2 pt-8 pb-8">
            {CLIENTS.map((client) => (
              <div
                key={client}
                className="flex-1 flex items-center justify-end pr-3"
              >
                <span
                  className={`font-mono text-xs font-bold ${
                    THEME[client].split(" ")[0]
                  }`}
                >
                  {client}
                </span>
              </div>
            ))}
          </div>

          <div
            ref={ganttContainerRef}
            className="flex-1 overflow-x-auto relative flex flex-col pt-8 pb-4 scroll-smooth"
          >
            <div
              className="absolute top-0 left-0 h-full w-full pointer-events-none flex"
              style={{ width: `${Math.max(100, ganttHistory.length * 40)}px` }}
            >
              {Array.from({ length: 50 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 border-r border-slate-800/50 h-full"
                ></div>
              ))}
            </div>

            {/* Gantt Bars */}
            {CLIENTS.map((client) => (
              <div
                key={client}
                className="flex-1 border-b border-slate-800/30 flex items-center relative"
                style={{
                  width: `${Math.max(100, ganttHistory.length * 40)}px`,
                }}
              >
                {ganttHistory
                  .filter((b) => b.clientId === client)
                  .map((block) => (
                    <div
                      key={block.id}
                      className={`absolute h-3/4 rounded-sm shadow-lg ${THEME_SOLID[client]} bg-opacity-80 border border-white/20 flex items-center justify-center`}
                      style={{
                        left: `${
                          ganttHistory.findIndex((b) => b.id === block.id) * 40
                        }px`,
                        width: "30px",
                        transition: "all 0.5s ease-out",
                      }}
                    >
                      <span className="text-[6px] text-white font-bold opacity-80">
                        C{block.coreId}
                      </span>
                    </div>
                  ))}
              </div>
            ))}

            {/* Time Axis (X-Axis Data) */}
            <div
              className="flex h-6 border-t border-slate-800/50 mt-1 relative"
              style={{ width: `${Math.max(100, ganttHistory.length * 40)}px` }}
            >
              {ganttHistory.map(
                (block, idx) =>
                  idx % 5 === 0 && ( // Show timestamp every 5 blocks
                    <div
                      key={`time-${idx}`}
                      className="absolute text-[9px] text-slate-500 font-mono -translate-x-1/2 mt-1"
                      style={{ left: `${idx * 40}px` }}
                    >
                      {new Date(block.endTime).toLocaleTimeString([], {
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  )
              )}
            </div>
          </div>
        </div>

        <div className="h-10 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between px-6 z-10">
          <span className="text-[10px] text-slate-500 font-mono">
            TIMELINE (CPU BURSTS) &rarr;
          </span>
          <div className="flex items-center space-x-4">
            <span className="text-[10px] text-slate-500">LEGEND:</span>
            {CLIENTS.map((c) => (
              <div key={c} className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${THEME_SOLID[c]}`}></div>
                <span className="text-[9px] text-slate-400 font-bold">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const CoreVisualizer = ({
    coreId,
    state,
  }: {
    coreId: number;
    state: { clientIndex: number };
  }) => {
    const sizeClass =
      cpuCount === 1 ? "w-32 h-32" : cpuCount === 2 ? "w-24 h-24" : "w-20 h-20";
    const labelClass = cpuCount > 2 ? "text-[8px]" : "text-[10px]";

    if (!state) return null;
    const theme = CORE_THEMES[coreId];

    return (
      <div
        className={`relative ${sizeClass} rounded-full border-4 border-slate-800 bg-slate-900/50 flex items-center justify-center m-2 shadow-inner`}
      >
        <div
          className={`absolute inset-0 rounded-full border-t-4 ${theme.border} transition-all duration-300 ease-linear shadow-[0_0_10px_currentColor]`}
          style={{ transform: `rotate(${state.clientIndex * 90}deg)` }}
        ></div>
        <div className="flex flex-col items-center">
          <Cpu
            size={cpuCount > 2 ? 16 : 24}
            className={`${
              isProcessing ? `${theme.text} animate-pulse` : "text-slate-600"
            }`}
          />
          <span className={`${labelClass} mt-1 font-mono text-slate-500`}>
            CORE_0{coreId}
          </span>
        </div>
        <div
          className={`absolute -bottom-6 ${labelClass} font-bold text-slate-400`}
        >
          {CLIENTS[state.clientIndex]}
        </div>
      </div>
    );
  };

  const activeTutorialStep = isTutorialActive
    ? TUTORIAL_STEPS[tutorialStep]
    : null;

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-auto relative">
      {/* --- CONFIGURATION OVERLAY --- */}
      {configMode && (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500"></div>

            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                <Settings size={32} className="text-cyan-400" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-widest mb-2">
                SYSTEM CONFIGURATION
              </h1>
              <p className="text-slate-400 text-sm max-w-md">
                Initialize the AlphaStream hardware environment. Select the
                number of physical cores for the scheduling simulation.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => initializeSystem(num)}
                  className="group relative h-32 bg-slate-950 border border-slate-800 rounded-xl hover:border-cyan-500 transition-all hover:bg-slate-900 flex flex-col items-center justify-center overflow-hidden"
                >
                  <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <Cpu
                    size={28}
                    className="text-slate-600 group-hover:text-cyan-400 mb-3 transition-colors"
                  />
                  <span className="text-2xl font-bold text-white mb-1">
                    {num}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                    Core{num > 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-center">
              <span className="text-[10px] text-slate-600 font-mono">
                WARNING: CONFIGURATION LOCKED AFTER BOOT
              </span>
            </div>
          </div>
        </div>
      )}

      {/* --- TUTORIAL LAYERS --- */}
      {isTutorialActive && activeTutorialStep && (
        <>
          <div className="fixed inset-0 z-40 bg-black/80 transition-opacity duration-500 pointer-events-auto" />
          <div
            className={`fixed max-w-md w-full bg-slate-900 border border-cyan-500/50 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.15)] p-6 z-[60] transition-all duration-500 ${
              activeTutorialStep.position === "center"
                ? "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                : activeTutorialStep.position === "right"
                ? "left-20 top-1/3"
                : activeTutorialStep.position === "left"
                ? "right-96 top-1/3 mr-8"
                : activeTutorialStep.position === "bottom-left"
                ? "top-20 right-20"
                : ""
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 rounded bg-cyan-500 flex items-center justify-center text-black font-bold text-xs">
                  {tutorialStep + 1}
                </div>
                <h3 className="text-lg font-bold text-white tracking-wide">
                  {activeTutorialStep.title}
                </h3>
              </div>
              <button
                onClick={skipTutorial}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              {activeTutorialStep.content}
            </p>
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div className="flex items-center space-x-1">
                {TUTORIAL_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === tutorialStep
                        ? "w-6 bg-cyan-400"
                        : "w-1.5 bg-slate-700"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center space-x-2">
                {tutorialStep > 0 && (
                  <button
                    onClick={prevStep}
                    className="px-3 py-1.5 rounded text-xs font-bold text-slate-400 hover:bg-slate-800 transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={nextStep}
                  className="px-4 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded flex items-center space-x-1 transition-all"
                >
                  <span>
                    {tutorialStep === TUTORIAL_STEPS.length - 1
                      ? "Finish"
                      : "Next"}
                  </span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- TOP BAR --- */}
      <header
        className={`h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-6 shadow-md sticky top-0 transition-all ${
          isHeaderHighlighted ? "z-50" : "z-30"
        }`}
      >
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-white">
              ALPHASTREAM <span className="text-cyan-500">CORE</span>
            </h1>
            <div className="text-[10px] text-slate-500 flex items-center space-x-2">
              <span className="flex items-center">
                <ShieldCheck size={10} className="mr-1" /> CORES: {cpuCount}
              </span>
              <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
              <span>V.4.6.4</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-6">
          {/* View Toggle */}
          <div
            id="view-toggle"
            className={`flex bg-slate-900 rounded-lg p-1 border border-slate-800 ${getHighlightClass(
              "view-toggle"
            )}`}
          >
            <button
              onClick={() => setViewMode("GRID")}
              className={`px-3 py-1 rounded-md text-[10px] font-bold flex items-center space-x-1 transition-all ${
                viewMode === "GRID"
                  ? "bg-slate-700 text-white shadow"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <LayoutGrid size={12} />
              <span>GRID</span>
            </button>
            <button
              onClick={() => setViewMode("GANTT")}
              className={`px-3 py-1 rounded-md text-[10px] font-bold flex items-center space-x-1 transition-all ${
                viewMode === "GANTT"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <BarChart3 size={12} />
              <span>GANTT</span>
            </button>
          </div>

          <button
            onClick={startTutorial}
            className="text-slate-500 hover:text-cyan-400 transition-colors flex items-center space-x-1"
          >
            <HelpCircle size={16} />
            <span className="text-[10px] font-bold uppercase hidden md:inline">
              Tutorial
            </span>
          </button>

          <div
            id="quantum-slider"
            className={`flex items-center space-x-3 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800 ${getHighlightClass(
              "quantum-slider"
            )}`}
          >
            <Clock size={14} className="text-slate-400 ml-1" />
            <div className="flex flex-col">
              <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                Time Quantum
              </span>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="100"
                  max="3000"
                  step="100"
                  value={tickRate}
                  onChange={(e) => setTickRate(Number(e.target.value))}
                  className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] font-mono w-10 text-right text-cyan-400">
                  {tickRate}ms
                </span>
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 mx-2"></div>

          <div
            id="controls-area"
            className={`flex items-center space-x-3 ${getHighlightClass(
              "controls-area"
            )}`}
          >
            <button
              onClick={() => setAutoInject(!autoInject)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center space-x-2 ${
                autoInject
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/50"
                  : "bg-slate-900 text-slate-500 border border-slate-800"
              }`}
            >
              <Layers size={14} />
              <span>{autoInject ? "INJECTING" : "INJECT DATA"}</span>
            </button>

            <button
              onClick={() => setIsProcessing(!isProcessing)}
              className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center space-x-2 ${
                isProcessing
                  ? "bg-red-500/20 text-red-400 border border-red-500/50"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
              }`}
            >
              {isProcessing ? <Pause size={14} /> : <Play size={14} />}
              <span>{isProcessing ? "HALT SYSTEM" : "INITIATE"}</span>
            </button>

            {/* Hard Reset Button */}
            <button
              onClick={resetSystem}
              className="ml-2 w-8 h-8 rounded bg-slate-900 border border-slate-800 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-500 text-slate-500 transition-all flex items-center justify-center"
              title="Hard Reset & Reconfigure"
            >
              <Power size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT GRID --- */}
      <div className="flex-1 flex items-stretch overflow-hidden">
        {/* LEFT: CONTENT */}
        {viewMode === "GRID" ? (
          <div
            id="queue-grid"
            className={`flex-1 grid grid-cols-4 bg-slate-950/50 relative overflow-y-auto ${getHighlightClass(
              "queue-grid"
            )}`}
          >
            {CLIENTS.map((id) => (
              <ClientColumn key={id} id={id} />
            ))}
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
                height: "100%",
              }}
            ></div>
          </div>
        ) : (
          <GanttPanel />
        )}

        {/* RIGHT: PROCESSOR & LOGS */}
        <div
          className={`w-96 border-l border-slate-800 bg-slate-950 flex flex-col shadow-2xl sticky top-14 h-[calc(100vh-3.5rem)] transition-all ${
            isSidebarHighlighted ? "z-50" : "z-20"
          }`}
        >
          <div
            id="processor-core"
            className={`h-64 border-b border-slate-800 p-4 relative overflow-hidden flex-shrink-0 ${getHighlightClass(
              "processor-core"
            )}`}
          >
            <div className="absolute inset-0 bg-slate-900/50"></div>

            {/* Multi-Core Layout Grid */}
            <div className="relative z-10 w-full h-full flex items-center justify-center flex-wrap content-center">
              {Array.from({ length: cpuCount }).map((_, i) => (
                <CoreVisualizer key={i} coreId={i} state={coreStates[i]} />
              ))}
            </div>
          </div>

          <div
            id="execution-logs"
            className={`flex-1 flex flex-col min-h-0 bg-slate-950 ${getHighlightClass(
              "execution-logs"
            )}`}
          >
            <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 flex items-center">
                <Terminal size={12} className="mr-2" /> EXECUTION_LOG
              </span>
              <div className="flex items-center space-x-2">
                <div className="flex flex-col items-end">
                  <span className="text-[8px] text-slate-500 uppercase">
                    SYS LATENCY
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      metrics.avgLatency > 5000
                        ? "text-red-500"
                        : "text-emerald-400"
                    }`}
                  >
                    {metrics.avgLatency}ms
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
              {logs.length === 0 && (
                <div className="p-4 text-center text-slate-600 italic">
                  No cycles executed.
                </div>
              )}
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center space-x-2 text-slate-400 p-1.5 hover:bg-slate-900 rounded border-b border-slate-800/50"
                >
                  <span className="text-slate-600 w-12">
                    {
                      new Date(log.processedAt)
                        .toLocaleTimeString()
                        .split(" ")[0]
                    }
                  </span>
                  <span className="w-6 text-slate-500 font-bold">
                    C{log.coreId}
                  </span>
                  <span
                    className={`w-12 font-bold ${
                      THEME[log.clientId].split(" ")[0]
                    }`}
                  >
                    {log.clientId}
                  </span>
                  <span className="flex-1 truncate">{log.content}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-slate-950 font-bold ${
                      log.latencyMs > 3000 ? "bg-red-400" : "bg-emerald-400"
                    }`}
                  >
                    {log.latencyMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px;
          width: 12px;
          border-radius: 50%;
          background: #22d3ee;
          cursor: pointer;
          margin-top: -4px;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          cursor: pointer;
          background: #334155;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
