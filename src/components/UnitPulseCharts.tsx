import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  TooltipProps
} from 'recharts';
import { store, BinaryUnit } from '../state';

// Global cache to remember state during full-DOM-rebuild re-renders of renderApp()
let cachedSelectedUnitId: string | null = null;
let cachedTimeframe: '24h' | '7d' = '24h';
let cachedAutoPingActive = false;

interface ChartDataPoint {
  label: string;
  cohesion: number;
  activity: number;
}

// Generate stable deterministic pseudo-random curves for each unit
function generateHistoricalData(unit: BinaryUnit, timeframe: '24h' | '7d', localPingAddon: number): ChartDataPoint[] {
  const points = timeframe === '24h' ? 12 : 7;
  const data: ChartDataPoint[] = [];
  const baseCohesion = unit.cohesionContribution || 25;
  
  // Create a deterministic hash seed from unit id
  let hash = 0;
  for (let i = 0; i < unit.id.length; i++) {
    hash = unit.id.charCodeAt(i) + ((hash << 5) - hash);
  }

  for (let i = 0; i < points; i++) {
    const angle = (i / (points - 1)) * Math.PI * 1.5;
    const wave = Math.sin(angle + (hash % 10)) * 14;
    const noise = Math.cos(angle * 2.5 + (hash % 4)) * 6;
    
    // Gradual progression up towards the target baseCohesion
    const ratio = i / (points - 1);
    const cohesionVal = Math.max(10, Math.min(100, Math.round(
      (baseCohesion * 0.75) + 
      (baseCohesion * 0.25 * ratio) + 
      wave * (1 - ratio * 0.4) + 
      noise + 
      (localPingAddon * 5)
    )));

    // Activity levels fluctuation
    const activityVal = Math.max(15, Math.min(100, Math.round(
      50 + 
      Math.sin(angle * 3.5 + (hash % 7)) * 28 + 
      Math.cos(angle * 1.2 + (hash % 3)) * 14 +
      (localPingAddon * 2)
    )));

    const label = timeframe === '24h' 
      ? `-${(points - 1 - i) * 2}h` 
      : `Dzień ${i + 1}`;

    data.push({
      label,
      cohesion: cohesionVal,
      activity: activityVal
    });
  }

  return data;
}

// Custom Tooltip component styled with retro-cyberpunk HUD specifications
const CyberTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/95 border border-neutral-800 rounded-lg p-3.5 shadow-2xl font-mono text-[10px] space-y-2 min-w-[140px] z-50">
        <div className="text-neutral-500 uppercase tracking-widest border-b border-neutral-900 pb-1.5 mb-1.5">
          Etykieta: <span className="text-neutral-300 font-bold">{label}</span>
        </div>
        {payload.map((p: any, idx: number) => {
          const color = p.name === 'Spójność' ? 'text-[#cb23ff]' : 'text-[#00ff9d]';
          const glow = p.name === 'Spójność' ? 'drop-shadow-[0_0_4px_rgba(203,35,255,0.4)]' : 'drop-shadow-[0_0_4px_rgba(0,255,157,0.4)]';
          return (
            <div key={idx} className="flex justify-between items-center gap-4">
              <span className="text-neutral-400 capitalize">{p.name}:</span>
              <span className={`font-black ${color} ${glow}`}>{p.value} pkt</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

// Main interactive pulse view component
const UnitPulseChartsComponent: React.FC = () => {
  const [units, setUnits] = useState<BinaryUnit[]>(store.units);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(() => {
    if (cachedSelectedUnitId && store.units.some(u => u.id === cachedSelectedUnitId)) {
      return cachedSelectedUnitId;
    }
    return store.units.length > 0 ? store.units[0].id : null;
  });
  const [timeframe, setTimeframe] = useState<'24h' | '7d'>(cachedTimeframe);
  const [localPingsMap, setLocalPingsMap] = useState<Record<string, number>>({});
  const [autoPingActive, setAutoPingActive] = useState<boolean>(cachedAutoPingActive);

  // Sync state with the store subscription
  useEffect(() => {
    const unsub = store.subscribe(() => {
      setUnits([...store.units]);
      setSelectedUnitId(current => {
        if (current && store.units.some(u => u.id === current)) {
          return current;
        }
        return store.units.length > 0 ? store.units[0].id : null;
      });
    });
    return () => {
      unsub();
    };
  }, []);

  // Sync caches when state variables change
  useEffect(() => {
    cachedSelectedUnitId = selectedUnitId;
  }, [selectedUnitId]);

  useEffect(() => {
    cachedTimeframe = timeframe;
  }, [timeframe]);

  useEffect(() => {
    cachedAutoPingActive = autoPingActive;
  }, [autoPingActive]);

  // Handle the active selected unit object
  const activeUnit = useMemo(() => {
    return units.find(u => u.id === selectedUnitId) || null;
  }, [units, selectedUnitId]);

  // Generate Recharts-compatible data sequence
  const chartData = useMemo(() => {
    if (!activeUnit) return [];
    const extraPings = localPingsMap[activeUnit.id] || 0;
    return generateHistoricalData(activeUnit, timeframe, extraPings);
  }, [activeUnit, timeframe, localPingsMap]);

  // Auto emissions loop to show real-time pulsating dynamics on charts
  useEffect(() => {
    if (!autoPingActive) return;

    const timer = setInterval(() => {
      setLocalPingsMap(prev => {
        const updated = { ...prev };
        units.forEach(u => {
          // Add micro jitter to show moving pulses
          const current = updated[u.id] || 0;
          const jitter = Math.random() > 0.6 ? 1 : 0;
          updated[u.id] = Math.min(15, current + jitter);
        });
        return updated;
      });
    }, 4500);

    return () => clearInterval(timer);
  }, [autoPingActive, units]);

  // Handle trigger ping Action
  const handlePing = async (id: string) => {
    // 1. Record immediate feedback on chart
    setLocalPingsMap(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + 1
    }));
    
    // 2. Invoke Firestore update & central logging
    await store.pingUnit(id);
  };

  // Helper status color styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
      case 'synchronizing':
        return { text: 'text-[#00ff9d]', bg: 'bg-[#00ff9d]/10 border-[#00ff9d]/20', dot: 'bg-[#00ff9d]' };
      case 'ether':
      case 'wanderer':
        return { text: 'text-[#cb23ff]', bg: 'bg-[#cb23ff]/10 border-[#cb23ff]/20', dot: 'bg-[#cb23ff]' };
      default:
        return { text: 'text-[#ff0055]', bg: 'bg-[#ff0055]/10 border-[#ff0055]/20', dot: 'bg-[#ff0055]' };
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* LEFT: Charts & Detailed Analytics Area */}
      <div className="lg:col-span-2 p-6 rounded-xl border border-neutral-900 bg-neutral-950/40 relative flex flex-col space-y-6">
        {/* Chart Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-900 pb-5">
          <div className="space-y-1">
            <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${autoPingActive ? 'bg-[#00ff9d] animate-ping' : 'bg-neutral-600'}`}></span>
              Kardiometr Sferyczny Jądra: <span className="text-[#00ff9d] drop-shadow-[0_0_5px_#00ff9d50]">{activeUnit ? activeUnit.name : 'Narzędzie Bezczynne'}</span>
            </h3>
            <p className="text-[9px] text-neutral-500 uppercase tracking-wide">
              {activeUnit ? `Archetyp: ${activeUnit.archetype || 'Klasyczny'} • Ostatnia sesja: ${new Date(activeUnit.lastActive).toLocaleTimeString()}` : 'Wybierz zasób z bocznej konsoli'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <button
              onClick={() => setTimeframe('24h')}
              className={`px-3 py-1.5 rounded text-[8px] font-black uppercase tracking-wider font-mono border transition-all cursor-pointer ${
                timeframe === '24h'
                  ? 'bg-neutral-100 text-black border-white'
                  : 'text-neutral-500 bg-transparent border-neutral-900 hover:border-neutral-800 hover:text-neutral-300'
              }`}
            >
              24 Godziny
            </button>
            <button
              onClick={() => setTimeframe('7d')}
              className={`px-3 py-1.5 rounded text-[8px] font-black uppercase tracking-wider font-mono border transition-all cursor-pointer ${
                timeframe === '7d'
                  ? 'bg-neutral-100 text-black border-white'
                  : 'text-neutral-500 bg-transparent border-neutral-900 hover:border-neutral-800 hover:text-neutral-300'
              }`}
            >
              7 Dni
            </button>
          </div>
        </div>

        {/* The Main Pulse Chart Canvas Box */}
        {activeUnit ? (
          <div className="flex-1 w-full min-h-[300px] h-[340px] text-neutral-400 relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradientCohesion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#cb23ff" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#cb23ff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="gradientActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00ff9d" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#111111" />
                <XAxis 
                  dataKey="label" 
                  stroke="#444444" 
                  tick={{ fill: '#737373', fontSize: 9, fontFamily: 'monospace' }}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#444444" 
                  domain={[0, 100]}
                  tick={{ fill: '#737373', fontSize: 9, fontFamily: 'monospace' }}
                  tickLine={false}
                />
                <Tooltip content={<CyberTooltip />} cursor={{ stroke: '#222222', strokeWidth: 1 }} />
                <Legend 
                  verticalAlign="top" 
                  height={32} 
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{
                    fontFamily: 'monospace',
                    fontSize: '9px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    paddingBottom: '10px'
                  }}
                />
                <Area
                  name="Spójność"
                  type="monotone"
                  dataKey="cohesion"
                  stroke="#cb23ff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradientCohesion)"
                  activeDot={{ r: 5, strokeWidth: 1, stroke: '#cb23ff' }}
                />
                <Area
                  name="Aktywność"
                  type="monotone"
                  dataKey="activity"
                  stroke="#00ff9d"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradientActivity)"
                  activeDot={{ r: 5, strokeWidth: 1, stroke: '#00ff9d' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-24 text-neutral-600 font-mono text-[10px] uppercase">
            Brak zlokalizowanych źródeł sygnału w bazie danych.
          </div>
        )}

        {/* Stats strip for the selected unit */}
        {activeUnit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-neutral-900 text-center font-mono text-xs">
            <div className="bg-neutral-950/20 border border-neutral-900/60 rounded-lg p-3 space-y-1">
              <span className="block text-[8px] text-neutral-500 uppercase tracking-wider">Miernik Spójności</span>
              <span className="block font-black text-white text-sm">
                {activeUnit.cohesionContribution || 0} pkt
              </span>
            </div>
            <div className="bg-neutral-950/20 border border-neutral-900/60 rounded-lg p-3 space-y-1">
              <span className="block text-[8px] text-neutral-500 uppercase tracking-wider">Poziom Aktywności</span>
              <span className="block font-black text-[#00ff9d] text-sm">
                {chartData.length > 0 ? chartData[chartData.length - 1].activity : 0}%
              </span>
            </div>
            <div className="bg-neutral-950/20 border border-neutral-900/60 rounded-lg p-3 space-y-1">
              <span className="block text-[8px] text-neutral-500 uppercase tracking-wider">Sygnatura Wagi</span>
              <span className="block font-black text-neutral-400 capitalize text-sm">
                {activeUnit.weight || 'Średnia'}
              </span>
            </div>
            <div className="bg-neutral-950/20 border border-neutral-900/60 rounded-lg p-3 space-y-1">
              <span className="block text-[8px] text-neutral-500 uppercase tracking-wider">Status Emisji</span>
              <span className={`block font-black text-sm uppercase ${getStatusStyle(activeUnit.status).text}`}>
                {activeUnit.status}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: Selected unit actions & Quick Select list */}
      <div className="p-6 rounded-xl border border-neutral-900 bg-neutral-950/40 flex flex-col space-y-6">
        <div>
          <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
            Źródła Emisji
          </h3>
          <p className="text-[8px] text-neutral-500 uppercase tracking-wider mt-0.5">
            Wybierz jądro binarne do załadowania kardiometru
          </p>
        </div>

        {/* Scroller list of all available units */}
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
          {units.length === 0 ? (
            <p className="text-[10px] text-neutral-600 font-mono italic">Brak aktywnych jądra w systemie.</p>
          ) : (
            units.map(u => {
              const isSelected = u.id === selectedUnitId;
              const { text, bg, dot } = getStatusStyle(u.status);
              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedUnitId(u.id)}
                  className={`w-full text-left p-3 rounded-lg border text-[10px] font-mono transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-[#cb23ff]/10 border-[#cb23ff]/30 shadow-[0_0_12px_rgba(203,35,255,0.08)]'
                      : 'bg-black/30 border-neutral-900 hover:border-neutral-800'
                  }`}
                >
                  <div className="space-y-1">
                    <span className={`block font-bold ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                      {u.name}
                    </span>
                    <span className="block text-[8px] text-neutral-600 uppercase">
                      {u.archetype || 'Wojownik'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border ${bg} ${text}`}>
                      {u.status}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${dot} ${u.status === 'synchronizing' ? 'animate-ping' : ''}`}></span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Selected Unit Manual Operations Station */}
        {activeUnit && (
          <div className="space-y-4 pt-5 border-t border-neutral-900 mt-auto">
            <h4 className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
              Konsola Kalibracyjna Jądra
            </h4>

            <div className="space-y-3 font-mono">
              {/* Trigger Pulse (Ping) Action */}
              <button
                onClick={() => handlePing(activeUnit.id)}
                className="w-full py-2.5 bg-[#00ff9d] hover:bg-[#00ff9d]/90 hover:shadow-[0_0_12px_rgba(0,255,157,0.25)] text-black text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="w-1.5 h-1.5 bg-black rounded-full animate-pulse"></span>
                Inicjuj Impuls Sondażowy
              </button>

              {/* Toggle Auto Simulation Emission */}
              <button
                onClick={() => setAutoPingActive(!autoPingActive)}
                className={`w-full py-2.5 border text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  autoPingActive
                    ? 'border-[#cb23ff]/30 text-[#cb23ff] bg-[#cb23ff]/5'
                    : 'border-neutral-900 text-neutral-500 bg-transparent hover:border-neutral-800 hover:text-neutral-300'
                }`}
              >
                <span>Dynamiczny Auto-Monitor</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[6px] font-black ${
                  autoPingActive ? 'bg-[#cb23ff] text-black animate-pulse' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {autoPingActive ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Status Calibrator Quick Action Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-[8px] text-neutral-500 uppercase tracking-widest">
                  Konwersเตอร์ Stanu Jądra (State Converter)
                </label>
                <select
                  value={activeUnit.status}
                  onChange={async (e) => {
                    const nextStatus = e.target.value as any;
                    await store.updateUnitStatus(activeUnit.id, nextStatus);
                  }}
                  className="w-full bg-black border border-neutral-900 hover:border-neutral-800 transition-all text-neutral-200 px-3 py-2 text-[9px] rounded-lg font-mono outline-none focus:border-[#cb23ff] cursor-pointer"
                >
                  <option value="active">Active (Aktywny)</option>
                  <option value="synchronizing">Synchronizing (W dół fali)</option>
                  <option value="quarantined">Quarantined (Kwarantanna)</option>
                  <option value="ether">Ether (Eteryczna mgła)</option>
                  <option value="wanderer">Wanderer (Wędrowiec fali)</option>
                  <option value="dormant">Dormant (Uśpienie jądra)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export function mountUnitPulseCharts(container: HTMLElement) {
  const root = createRoot(container);
  root.render(<UnitPulseChartsComponent />);
  return () => {
    root.unmount();
  };
}
