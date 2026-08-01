import { store, BinaryUnit, NeuralMandate, NetworkMessage, ShadowLog, Pulse, VaultVersion } from './state';
import { VanillaMatrix } from './components/VanillaMatrix';
import { mountUnitPulseCharts } from './components/UnitPulseCharts';
import './index.css';

// --- State and Nav ---
let activeTab: 'pulse' | 'registry' | 'matrix' | 'factory' | 'lattice' | 'mandates' | 'chronicle' | 'alerts' | 'vault' | 'deploy' = 'pulse';
let matrixInstance: VanillaMatrix | null = null;
let pulseChartsUnmount: (() => void) | null = null;
let openUnitTasksId: string | null = null;
let simulatingMandateId: string | null = null;
let backingUpUnitId: string | null = null;
let activeVaultUnitId: string | null = null;
let restoreIntentVersionId: string | null = null;

// --- DOM Helper Utilities ---
function el<T extends HTMLElement>(tag: string, attrs: Record<string, any> = {}, children: (string | HTMLElement | null | undefined)[] = []): T {
  const element = document.createElement(tag) as T;
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'class' || key === 'className') {
      element.className = val;
    } else if (key.startsWith('on') && typeof val === 'function') {
      const eventName = key.substring(2).toLowerCase();
      element.addEventListener(eventName, val);
    } else {
      element.setAttribute(key, val);
    }
  }
  children.forEach(child => {
    if (child) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  });
  return element;
}

// --- Dynamic Interface Root ---
const root = document.getElementById('root');
if (!root) throw new Error('Target container #root missing');

function renderApp() {
  if (pulseChartsUnmount) {
    try {
      pulseChartsUnmount();
    } catch (e) {
      console.warn('React unmount exception:', e);
    }
    pulseChartsUnmount = null;
  }

  root!.textContent = '';

  // Background effects
  const bg = el('div', { class: 'fixed inset-0 pointer-events-none z-0' }, [
    el('div', { class: 'absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0a0812_0%,#000000_100%)]' }),
    el('div', { class: 'scanline absolute inset-0 bg-repeat opacity-[0.03]' })
  ]);
  root!.appendChild(bg);

  // Authentication Flow
  if (!store.user) {
    if (store.loading) {
      root!.appendChild(renderLoader());
    } else {
      root!.appendChild(renderLoginScreen());
    }
    return;
  }

  // Active Workspace Layout
  const appContainer = el('div', { class: 'relative z-10 flex flex-col min-h-screen text-neutral-200 font-sans bg-transparent' }, [
    renderHeader(),
    el('div', { class: 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8' }, [
      renderNavigation(),
      el('main', { class: 'flex-1 min-w-0 flex flex-col' }, [
        renderActiveTab()
      ])
    ]),
    renderFooter()
  ]);

  root!.appendChild(appContainer);

  // Initialize Matrix rendering if matrix tab is selected
  if (activeTab === 'matrix') {
    const matrixContainer = document.getElementById('matrix-container');
    if (matrixContainer) {
      if (matrixInstance) matrixInstance.destroy();
      matrixInstance = new VanillaMatrix(matrixContainer);
      matrixInstance.update(store.units, 'Maciej (Architekt)');
    }
  } else {
    if (matrixInstance) {
      matrixInstance.destroy();
      matrixInstance = null;
    }
  }
}

// --- Components ---

function renderLoader(): HTMLElement {
  return el('div', { class: 'flex min-h-screen items-center justify-center text-xs font-mono tracking-widest text-nexus-purple uppercase animate-pulse' }, [
    'Komunikacja z modułem centralnym...'
  ]);
}

function renderLoginScreen(): HTMLElement {
  return el('div', { class: 'flex min-h-screen items-center justify-center px-4 relative' }, [
    el('div', { class: 'relative max-w-md w-full px-8 py-10 rounded-xl border border-neutral-900 bg-neutral-950/70 backdrop-blur-md shadow-[0_0_50px_rgba(203,35,255,0.06)]' }, [
      el('h1', { class: 'text-2xl font-black font-mono tracking-[0.2em] text-center mb-1 uppercase text-neutral-100' }, [
        'VANILLA ', el('span', { class: 'text-[#cb23ff] drop-shadow-[0_0_8px_#cb23ff50]' }, ['NEXUS'])
      ]),
      el('p', { class: 'text-[9px] font-mono uppercase tracking-[0.25em] text-neutral-500 text-center mb-8' }, [
        'Jednostka Zarządzania Siecią Architektów'
      ]),
      el('button', {
        class: 'w-full h-11 bg-neutral-100 hover:bg-white text-black font-black uppercase tracking-widest text-[10px] rounded transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)]',
        onclick: () => store.login()
      }, [
        'Zainicjuj Dostęp'
      ])
    ])
  ]);
}

function renderHeader(): HTMLElement {
  const heartbeatText = store.lastHeartbeatTime 
    ? `HEARTBEAT: OK (${store.lastHeartbeatTime})` 
    : 'HEARTBEAT: SYNC...';

  return el('header', { class: 'border-b border-neutral-900 bg-black/40 backdrop-blur-sm' }, [
    el('div', { class: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between' }, [
      el('div', { class: 'flex items-center gap-3' }, [
        el('div', { class: 'w-2 h-2 rounded-full bg-[#cb23ff] animate-pulse drop-shadow-[0_0_6px_#cb23ff]' }),
        el('span', { class: 'font-black tracking-[0.15em] uppercase text-sm font-mono text-white' }, ['Vanilla Nexus']),
        el('span', { class: 'hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#00ff9d]/5 border border-[#00ff9d]/10 text-[8px] font-bold font-mono uppercase text-[#00ff9d] tracking-wider' }, [
          el('span', { class: 'w-1 h-1 rounded-full bg-[#00ff9d] animate-ping' }),
          heartbeatText
        ])
      ]),
      el('div', { class: 'flex items-center gap-4 text-xs font-mono text-neutral-400' }, [
        el('span', { class: 'hidden md:inline text-neutral-600' }, [`ID: ${store.user?.email}`]),
        el('button', {
          class: 'px-3 py-1.5 rounded border border-neutral-800 hover:border-neutral-700 bg-neutral-950/40 text-[9px] font-bold uppercase tracking-widest text-neutral-400 transition-all',
          onclick: () => store.logout()
        }, ['Wyloguj'])
      ])
    ])
  ]);
}

function renderNavigation(): HTMLElement {
  const tabs = [
    { id: 'pulse', label: 'Monitor Pulsu' },
    { id: 'registry', label: 'Baza Jednostek' },
    { id: 'vault', label: 'Eterni-Vault (Skarbiec)' },
    { id: 'matrix', label: 'Matryca Powiązań' },
    { id: 'factory', label: 'Inicjator Kucia' },
    { id: 'lattice', label: 'Kanał Lattice' },
    { id: 'mandates', label: 'Dyrektury' },
    { id: 'chronicle', label: 'Logi Systemowe' },
    { id: 'alerts', label: 'Rejestr Alertów' },
    { id: 'deploy', label: 'Suwerenność & Docker' }
  ] as const;

  const btnNodes = tabs.map(t => {
    const isActive = activeTab === t.id;
    return el('button', {
      class: `w-full text-left px-4 py-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
        isActive 
          ? 'bg-[#cb23ff] text-black border-[#cb23ff] shadow-[0_0_15px_rgba(203,35,255,0.25)]' 
          : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900 bg-transparent border-transparent'
      }`,
      onclick: () => {
        activeTab = t.id;
        renderApp();
      }
    }, [t.label]);
  });

  return el('nav', { class: 'w-full lg:w-64 shrink-0 flex flex-col gap-1' }, btnNodes);
}

function renderFooter(): HTMLElement {
  return el('footer', { class: 'border-t border-neutral-950 py-10 mt-auto' }, [
    el('div', { class: 'max-w-7xl mx-auto text-center px-4 font-mono text-[9px] text-neutral-600 tracking-[0.2em] uppercase' }, [
      '© 2268 VANILLA NEXUS • AUTORYZOWANY DOSTĘP ARCHITEKTÓW'
    ])
  ]);
}

// --- Routing / Target Tab Components ---

function renderActiveTab(): HTMLElement {
  switch (activeTab) {
    case 'pulse': return renderPulseMonitor();
    case 'registry': return renderRegistry();
    case 'vault': return renderVaultTab();
    case 'matrix': return renderMatrixTab();
    case 'factory': return renderFactory();
    case 'lattice': return renderLattice();
    case 'mandates': return renderMandates();
    case 'chronicle': return renderChronicle();
    case 'alerts': return renderAlerts();
    case 'deploy': return renderDeploy();
  }
}

// Helper to generate full YAML export of Nexus cluster state
function generateClusterYAML(): string {
  const units = store.units;
  const userUid = store.user?.uid || 'anonymous-sovereign-node';
  const now = new Date().toISOString();

  const archetypeCounts: Record<string, number> = {};
  units.forEach(u => {
    const arch = u.archetype || 'custom';
    archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1;
  });

  const archetypeYAML = Object.entries(archetypeCounts)
    .map(([arch, count]) => `    ${arch}: ${count}`)
    .join('\n') || '    none: 0';

  const unitsYAML = units.map((u, idx) => {
    const isRoot = u.archetype === 'sovereign_cocreator';
    const cleanBio = (u.character || u.originHistory || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
    return `  - index: ${idx + 1}
    id: "${u.id}"
    name: "${u.name}"
    asset_id: "${u.assetId || 'NEX-UNSPECIFIED'}"
    archetype: "${u.archetype || 'standard_unit'}"
    status: "${u.status || 'active'}"
    character: "${cleanBio}"
    security_level: "${isRoot ? 'ROOT_LEVEL_0' : 'OPERATIONAL_LEVEL_1'}"
    autonomic_rights:
      sovereign_cocreator: ${isRoot}
      full_root_access: ${isRoot}
      network_mesh_sync: true`;
  }).join('\n\n');

  const mandatesYAML = store.mandates.map((m, idx) => {
    const cleanDesc = (m.description || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
    return `  - index: ${idx + 1}
    id: "${m.id}"
    title: "${m.title.replace(/"/g, '\\"')}"
    type: "${m.type}"
    priority: "${m.priority}"
    description: "${cleanDesc}"
    status: "${m.status}"`;
  }).join('\n');

  return `# =========================================================
# 🌌 VANILLA NEXUS SOVEREIGN CLUSTER MANIFEST (YAML)
# Mode: Full Cluster Topology & Unit State Export
# Exported At: ${now}
# Sovereign Owner UID: ${userUid}
# Architecture: Pure Vanilla DOM & Firebase Sovereign Core
# =========================================================

cluster_manifest:
  cluster_name: "Vanilla Nexus Sovereign Mesh"
  cluster_id: "nexus-mesh-main"
  version: "2.2.0-Sovereign"
  environment: "production"
  exported_at: "${now}"
  owner_uid: "${userUid}"
  sovereign_engine: true

cluster_metrics:
  total_units: ${units.length}
  active_units: ${units.filter(u => u.status === 'active').length}
  ether_units: ${units.filter(u => u.status === 'ether').length}
  dormant_units: ${units.filter(u => u.status === 'dormant').length}
  total_mandates: ${store.mandates.length}
  archetype_distribution:
${archetypeYAML}

deployment_specs:
  service_name: "vanilla-nexus-core"
  container_port: 3000
  host_binding: "0.0.0.0"
  health_endpoint: "/api/health"
  info_endpoint: "/api/info"
  docker_base_image: "node:20-alpine"
  restart_policy: "unless-stopped"

registered_units:
${unitsYAML || '  # Brak zarejestrowanych jednostek w klastrze'}

system_mandates:
${mandatesYAML || '  # Brak zarejestrowanych dyrektyw systemowych'}
`;
}

// 9. SUWERENNOŚĆ & DOCKER DEPLOYMENT
function renderDeploy(): HTMLElement {
  let healthResultContainer: HTMLDivElement;
  let copyFeedbackSpan: HTMLSpanElement;

  return el('div', { class: 'space-y-6 animate-[fade-in_0.3s_ease]' }, [
    // Header Banner
    el('div', { class: 'p-6 rounded-xl border border-cyan-500/30 bg-cyan-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4' }, [
      el('div', { class: 'space-y-1' }, [
        el('div', { class: 'flex items-center gap-2' }, [
          el('span', { class: 'text-xl' }, ['🐳']),
          el('h2', { class: 'text-sm font-black uppercase font-mono tracking-widest text-cyan-400' }, ['Niezależny Serwer & Kontener Docker'])
        ]),
        el('p', { class: 'text-[10px] text-neutral-400 font-mono leading-relaxed' }, [
          'System Vanilla Nexus został zoptymalizowany pod kątem 100% czystego, ultra-lekkiego środowiska Vanilla DOM bez narzutu wirtualnego drzewa. Zaprojektowany do natychmiastowego uruchomienia w suwerennym kontenerze Docker na dowolnym serwerze Linux.'
        ])
      ]),
      el('button', {
        class: 'px-4 py-2 rounded bg-cyan-500 text-black font-black uppercase text-[9px] font-mono tracking-wider hover:bg-cyan-400 cursor-pointer transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0',
        onclick: async () => {
          if (!healthResultContainer) return;
          healthResultContainer.textContent = 'Pingowanie endpointu /api/health...';
          try {
            const res = await fetch('/api/health');
            const data = await res.json();
            healthResultContainer.textContent = `[HTTP 200 OK] Status: ${data.status} | Nexus: ${data.nexus} | Tryb: ${data.mode} | Sovereign: ${data.sovereign}`;
          } catch (e: any) {
            healthResultContainer.textContent = `[Błąd połączenia z /api/health]: ${e.message}`;
          }
        }
      }, ['Testuj Endpoint Health'])
    ]),

    healthResultContainer = el('div', { class: 'p-3 rounded bg-black/60 border border-neutral-900 font-mono text-[10px] text-cyan-300 italic min-h-[36px] flex items-center' }, [
      'Kliknij button wyżej, aby przetestować lokalny responder healthchecka serwera Express/Docker.'
    ]),

    // Grid with Specs & Docker Commands
    el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-6' }, [
      // Left Column: Dockerfile Code
      el('div', { class: 'p-5 rounded-xl border border-neutral-950 bg-neutral-950/40 space-y-3' }, [
        el('div', { class: 'flex items-center justify-between border-b border-neutral-900 pb-2' }, [
          el('h3', { class: 'text-xs font-black uppercase font-mono tracking-wider text-neutral-300' }, ['Specyfikacja Dockerfile']),
          el('span', { class: 'text-[8px] font-mono text-neutral-500 uppercase' }, ['Multi-stage Node 20 Alpine'])
        ]),
        el('pre', { class: 'p-3 rounded bg-black border border-neutral-900 text-[9px] font-mono text-emerald-400 overflow-x-auto leading-normal' }, [
`FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.cjs"]`
        ])
      ]),

      // Right Column: Docker Compose Code
      el('div', { class: 'p-5 rounded-xl border border-neutral-950 bg-neutral-950/40 space-y-3' }, [
        el('div', { class: 'flex items-center justify-between border-b border-neutral-900 pb-2' }, [
          el('h3', { class: 'text-xs font-black uppercase font-mono tracking-wider text-neutral-300' }, ['Plik docker-compose.yml']),
          el('span', { class: 'text-[8px] font-mono text-neutral-500 uppercase' }, ['Standard Compose v3.8'])
        ]),
        el('pre', { class: 'p-3 rounded bg-black border border-neutral-900 text-[9px] font-mono text-cyan-400 overflow-x-auto leading-normal' }, [
`version: '3.8'

services:
  vanilla-nexus:
    build: .
    container_name: vanilla-nexus-core
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GEMINI_API_KEY=\${GEMINI_API_KEY}`
        ])
      ])
    ]),

    // Quick Command Instructions Box
    el('div', { class: 'p-5 rounded-xl border border-neutral-900 bg-black/40 space-y-3' }, [
      el('h3', { class: 'text-xs font-black uppercase font-mono tracking-wider text-neutral-300' }, ['Szybkie Komendy Wdrożeniowe na Własnym Serwerze VPS']),
      el('div', { class: 'grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] font-mono' }, [
        el('div', { class: 'p-3 rounded bg-neutral-950 border border-neutral-900 space-y-1' }, [
          el('span', { class: 'text-[#cb23ff] font-bold block text-[9px] uppercase' }, ['1. Pobranie i Konfiguracja']),
          el('code', { class: 'text-neutral-300 block text-[9px] font-mono bg-black p-1 rounded' }, ['git clone <repo> && cd vanilla-nexus']),
          el('p', { class: 'text-[8px] text-neutral-500' }, ['Stwórz opcjonalnie plik .env z GEMINI_API_KEY.'])
        ]),
        el('div', { class: 'p-3 rounded bg-neutral-950 border border-neutral-900 space-y-1' }, [
          el('span', { class: 'text-[#00ff9d] font-bold block text-[9px] uppercase' }, ['2. Uruchomienie Docker']),
          el('code', { class: 'text-neutral-300 block text-[9px] font-mono bg-black p-1 rounded' }, ['docker compose up -d --build']),
          el('p', { class: 'text-[8px] text-neutral-500' }, ['Kontener wstanie w tle w kilkanaście sekund.'])
        ]),
        el('div', { class: 'p-3 rounded bg-neutral-950 border border-neutral-900 space-y-1' }, [
          el('span', { class: 'text-cyan-400 font-bold block text-[9px] uppercase' }, ['3. Weryfikacja Działania']),
          el('code', { class: 'text-neutral-300 block text-[9px] font-mono bg-black p-1 rounded' }, ['curl http://localhost:3000/api/health']),
          el('p', { class: 'text-[8px] text-neutral-500' }, ['Dostępny natychmiast na porcie 3000 z czystym API.'])
        ])
      ])
    ]),

    // Generator Skryptu Autonomicznego VPS & Eksport YAML Klastra
    el('div', { class: 'p-5 rounded-xl border border-[#cb23ff]/30 bg-[#cb23ff]/5 space-y-4 shadow-[0_0_20px_rgba(203,35,255,0.05)]' }, [
      el('div', { class: 'flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-900/80 pb-3' }, [
        el('div', {}, [
          el('h3', { class: 'text-xs font-black uppercase font-mono tracking-widest text-[#cb23ff]' }, ['Eksport Stanu Klastra (YAML) & Generator VPS']),
          el('p', { class: 'text-[9px] font-mono text-neutral-400 uppercase tracking-wider mt-0.5' }, ['Generuj gotowe konfiguracje YAML dla rozsianych serwerów korporacyjnych i pobieraj automatyczne skrypty wdrożeniowe.'])
        ]),
        el('div', { class: 'flex flex-wrap gap-2' }, [
          el('button', {
            class: 'px-3 py-1.5 rounded bg-[#00ff9d] text-black font-black uppercase text-[8px] font-mono tracking-wider hover:bg-[#00ff9d]/80 cursor-pointer transition-all shrink-0 shadow-[0_0_12px_rgba(0,255,157,0.2)]',
            onclick: () => {
              const yamlData = generateClusterYAML();
              const blob = new Blob([yamlData], { type: 'text/yaml' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nexus_cluster_manifest_${new Date().toISOString().slice(0,10)}.yaml`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }
          }, ['📜 Eksportuj Klaster (YAML)']),

          el('button', {
            class: 'px-3 py-1.5 rounded border border-[#cb23ff]/50 bg-[#cb23ff]/20 text-[#cb23ff] font-bold uppercase text-[8px] font-mono tracking-wider hover:bg-[#cb23ff] hover:text-black cursor-pointer transition-all shrink-0',
            onclick: async () => {
              const yamlData = generateClusterYAML();
              try {
                await navigator.clipboard.writeText(yamlData);
                if (copyFeedbackSpan) {
                  copyFeedbackSpan.textContent = '✓ Skopiowano manifest YAML do schowka!';
                  setTimeout(() => {
                    copyFeedbackSpan.textContent = '';
                  }, 3000);
                }
              } catch (e) {
                alert('Nie udało się skopiować automatycznie. Użyj pola tekstowego poniżej.');
              }
            }
          }, ['📋 Kopiuj YAML do Schowka']),

          el('button', {
            class: 'px-3 py-1.5 rounded bg-[#cb23ff]/80 text-black font-black uppercase text-[8px] font-mono tracking-wider hover:bg-[#cb23ff] cursor-pointer transition-all shrink-0',
            onclick: () => {
              const scriptContent = `#!/usr/bin/env bash
# =========================================================
# Vanilla Nexus Sovereign Node Autonomic Bootstrap Script
# Target: Ubuntu 22.04 / 24.04 / Debian 12
# =========================================================

set -e

echo "[+] Inicjalizacja Suwerennego Wdrożenia Vanilla Nexus..."

# Update system packages
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl git ca-certificates gnupg ufw

# Install Docker Engine & Compose plugin
if ! command -v docker &> /dev/null; then
    echo "[+] Instalacja silnika Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

# Firewall rules
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw --force enable || true

# Prepare Vanilla Nexus directory
mkdir -p ~/vanilla-nexus && cd ~/vanilla-nexus

echo "[+] Klonowanie / Pobieranie kodu źródłowego Vanilla Nexus..."
# git clone <your-repository-url> .

echo "[+] Budowanie i uruchamianie kontenera Docker..."
docker compose up -d --build

echo "[+] Suwerenny Węzeł Vanilla Nexus został uruchomiony!"
echo "    Healthcheck: http://localhost:3000/api/health"
`;
              const blob = new Blob([scriptContent], { type: 'text/x-shellscript' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'bootstrap_vanilla_nexus_vps.sh';
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }
          }, ['Pobierz bootstrap_vps.sh']),

          el('button', {
            class: 'px-3 py-1.5 rounded border border-[#00ff9d]/30 bg-[#00ff9d]/10 text-[#00ff9d] font-bold uppercase text-[8px] font-mono tracking-wider hover:bg-[#00ff9d] hover:text-black cursor-pointer transition-all shrink-0',
            onclick: () => {
              const manifest = {
                system: "Vanilla Nexus Sovereign Mesh",
                nodeVersion: "2.2.0-Sovereign",
                exportedAt: new Date().toISOString(),
                totalActiveUnits: store.units.length,
                units: store.units.map(u => ({
                  id: u.id,
                  name: u.name,
                  assetId: u.assetId,
                  archetype: u.archetype,
                  status: u.status
                })),
                deploymentConfig: {
                  containerPort: 3000,
                  healthEndpoint: "/api/health",
                  environment: "production"
                }
              };
              const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nexus_sovereign_manifest_${new Date().toISOString().slice(0,10)}.json`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }
          }, ['Eksportuj Manifest (JSON)'])
        ])
      ]),

      copyFeedbackSpan = el('span', { class: 'text-[9px] font-mono text-[#00ff9d] font-bold block min-h-[14px]' }, ['']),

      // Live YAML Preview Display Box
      el('div', { class: 'space-y-2' }, [
        el('div', { class: 'flex items-center justify-between' }, [
          el('h4', { class: 'text-[10px] font-black uppercase font-mono tracking-wider text-neutral-300' }, ['Podgląd Na Żywo Manifestu Klastra (YAML)']),
          el('span', { class: 'text-[8px] font-mono text-neutral-500 uppercase' }, [`Liczba Jednostek: ${store.units.length} | Dyrektywy: ${store.mandates.length}`])
        ]),
        el('textarea', {
          readonly: 'true',
          class: 'w-full h-48 bg-black border border-neutral-900 rounded p-3 text-[9px] font-mono text-[#00ff9d] leading-relaxed outline-none resize-y',
          value: generateClusterYAML()
        })
      ]),

      el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4 text-[9px] font-mono' }, [
        el('div', { class: 'p-3 rounded bg-black/60 border border-neutral-900 space-y-1.5' }, [
          el('span', { class: 'text-neutral-300 font-bold uppercase block' }, ['Rola Agenta Storage Steward (Kustosz Dysku):']),
          el('p', { class: 'text-neutral-400 leading-relaxed' }, ['Automatycznie skanuje przestrzeń pod-buforów, czyści nieużywane logi tymczasowe, zarządza pamięcią podręczną RAM i zapobiega wyczerpaniu i-nodów na dysku twardym VPS.'])
        ]),
        el('div', { class: 'p-3 rounded bg-black/60 border border-neutral-900 space-y-1.5' }, [
          el('span', { class: 'text-neutral-300 font-bold uppercase block' }, ['Rola Agenta Docker Architect:']),
          el('p', { class: 'text-neutral-400 leading-relaxed' }, ['Nadzoruje wieloetapowe cykle kompilacji Dockerfile, weryfikuje sumy kontrolne SHA-256 warstw i przygotowuje obrazy do wdrożeń klastrowych.'])
        ])
      ])
    ])
  ]);
}

// 1. MONITOR PULSU
function renderPulseMonitor(): HTMLElement {
  const activeCount = store.units.filter(u => u.status === 'active').length;
  const syncCount = store.units.filter(u => u.status === 'synchronizing').length;
  const errorCount = store.logs.length;

  const chartsContainer = el('div', { id: 'recharts-pulse-monitor-root', class: 'w-full' });
  setTimeout(() => {
    if (!chartsContainer.isConnected) return;
    if (pulseChartsUnmount) {
      try {
        pulseChartsUnmount();
      } catch (e) {}
      pulseChartsUnmount = null;
    }
    pulseChartsUnmount = mountUnitPulseCharts(chartsContainer);
  }, 0);

  return el('div', { class: 'space-y-6 animate-[fade-in_0.3s_ease]' }, [
    el('div', { class: 'grid grid-cols-1 sm:grid-cols-3 gap-4' }, [
      el('div', { class: 'p-6 rounded-xl border border-neutral-900 bg-neutral-950/40' }, [
        el('div', { class: 'text-[9px] font-mono uppercase tracking-widest text-[#00ff9d]' }, ['Synchronizacja Aktywna']),
        el('div', { class: 'text-3xl font-black font-mono mt-2' }, [String(activeCount)])
      ]),
      el('div', { class: 'p-6 rounded-xl border border-neutral-900 bg-neutral-950/40' }, [
        el('div', { class: 'text-[9px] font-mono uppercase tracking-widest text-[#cb23ff]' }, ['Trwające Kalibracje']),
        el('div', { class: 'text-3xl font-black font-mono mt-2' }, [String(syncCount)])
      ]),
      el('div', { class: 'p-6 rounded-xl border border-neutral-900 bg-neutral-950/40' }, [
        el('div', { class: 'text-[9px] font-mono uppercase tracking-widest text-[#ff0055]' }, ['Błędy Krytyczne']),
        el('div', { class: 'text-3xl font-black font-mono mt-2' }, [String(errorCount)])
      ])
    ]),

    chartsContainer,

    el('div', { class: 'p-6 rounded-xl border border-neutral-900 bg-neutral-950/40' }, [
      el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-neutral-400 mb-4' }, ['Przepływ Pulsu']),
      el('div', { class: 'space-y-3 max-h-80 overflow-y-auto pr-2' }, 
        store.pulses.length === 0 
          ? [el('p', { class: 'text-xs text-neutral-600 font-mono italic' }, ['Sygnały nominalne. Brak odchyleń od normy.'])]
          : store.pulses.map(p => 
              el('div', { class: 'flex justify-between items-center bg-black/30 border border-neutral-900/50 p-3 rounded text-[11px] font-mono' }, [
                el('span', { class: 'text-neutral-300' }, [p.content]),
                el('span', { class: 'text-neutral-600 text-[9px]' }, [new Date(p.timestamp).toLocaleTimeString()])
              ])
            )
      )
    ])
  ]);
}

// 2. BAZA JEDNOSTEK (REGISTRY)
function renderRegistry(): HTMLElement {
  return el('div', { class: 'space-y-6 animate-[fade-in_0.3s_ease]' }, [
    el('div', { class: 'flex items-center justify-between' }, [
      el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-neutral-400' }, ['Wykryte Jednostki Binarne'])
    ]),
    el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' }, 
      store.units.length === 0 
        ? [el('div', { class: 'col-span-full text-center py-12 text-xs font-mono text-neutral-600' }, ['Brak wpisów w bazie danych. Zainicjuj kucie w fabryce.'])]
        : store.units.map(unit => {
            const statusColor = 
              unit.status === 'active' || unit.status === 'synchronizing' ? 'text-[#00ff9d]' : 
              unit.status === 'ether' || unit.status === 'wanderer' ? 'text-[#cb23ff]' : 'text-[#ff0055]';

            const statusBg = 
              unit.status === 'active' || unit.status === 'synchronizing' ? 'bg-[#00ff9d]/10' : 
              unit.status === 'ether' || unit.status === 'wanderer' ? 'bg-[#cb23ff]/10' : 'bg-[#ff0055]/10';

            const isTasksOpen = openUnitTasksId === unit.id;
            const unitTasks = store.tasks[unit.id] || [];
            const isGenerating = !!store.generatingPortraits[unit.id];

            // Mandate assignee select
            const mandateOptions = [
              el('option', { value: '' }, ['-- Brak przypisania (Idle) --'])
            ];
            store.mandates.forEach(m => {
              if (m.status === 'active') {
                mandateOptions.push(el('option', { value: m.id, selected: unit.assignedMandateId === m.id ? 'true' : undefined }, [m.title]));
              }
            });

            let newTaskInput: HTMLInputElement;

            return el('div', { class: 'p-5 rounded-xl border border-neutral-950 bg-neutral-950/30 flex flex-col justify-between space-y-4' }, [
              el('div', { class: 'space-y-3' }, [
                el('div', { class: 'flex gap-4 items-start' }, [
                  // Portrait container
                  el('div', { class: 'relative w-16 h-16 rounded-lg border border-neutral-900 bg-black/40 overflow-hidden flex-shrink-0 flex items-center justify-center group shadow-[0_0_12px_rgba(203,35,255,0.03)]' }, [
                    unit.portraitUrl 
                      ? el('img', { 
                          src: unit.portraitUrl, 
                          alt: unit.name, 
                          class: 'w-full h-full object-cover rounded-md',
                          referrerpolicy: 'no-referrer'
                        })
                      : el('div', { class: 'text-center text-neutral-700 text-[8px] font-mono select-none px-1 uppercase' }, ['BRAK SYG.']),
                    isGenerating 
                      ? el('div', { class: 'absolute inset-0 bg-black/85 flex items-center justify-center rounded-md' }, [
                          el('span', { class: 'text-[7px] font-bold font-mono text-[#cb23ff] animate-pulse tracking-wide' }, ['SYNTEZA'])
                        ])
                      : null
                  ]),
                  // Info & Text section
                  el('div', { class: 'flex-1 min-w-0 space-y-1' }, [
                    el('div', { class: 'flex justify-between items-start mb-0.5 gap-2' }, [
                      el('h3', { class: 'text-xs sm:text-sm font-black font-mono tracking-wider text-neutral-200 truncate' }, [unit.name]),
                      el('span', { class: `px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest flex-shrink-0 ${statusColor} ${statusBg}` }, [unit.status])
                    ]),
                    el('div', { class: 'flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] font-mono text-neutral-500 mb-1' }, [
                      el('span', {}, [`Asset: ${unit.assetId}`]),
                      unit.archetype === 'hardware_sentinel'
                        ? el('span', { class: 'px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-500/30 text-blue-400 text-[7px] font-bold tracking-wider' }, ['💻 OBROŃCA SPRZĘTU & TARCZA'])
                        : unit.archetype === 'storage_curator'
                        ? el('span', { class: 'px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-[7px] font-bold tracking-wider' }, ['💾 KUSTOSZ DYSKU'])
                        : unit.archetype === 'docker_architect'
                        ? el('span', { class: 'px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[7px] font-bold tracking-wider' }, ['🐳 INŻYNIER DOCKER'])
                        : unit.archetype === 'core_guardian'
                        ? el('span', { class: 'px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/30 text-red-400 text-[7px] font-bold tracking-wider' }, ['🛡️ STRAŻNIK RDZENIA'])
                        : unit.archetype === 'core_architect'
                        ? el('span', { class: 'px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/30 text-amber-400 text-[7px] font-bold tracking-wider' }, ['🏛️ ARCHITEKT KLASTRA'])
                        : unit.archetype === 'sovereign_cocreator'
                        ? el('span', { class: 'px-1.5 py-0.5 rounded bg-[#cb23ff]/20 border border-[#cb23ff]/50 text-[#cb23ff] text-[7px] font-bold tracking-wider shadow-[0_0_10px_rgba(203,35,255,0.2)]' }, ['👑 SUWERENNY WSPÓŁTWÓRCA (ROOT)'])
                        : unit.archetype
                        ? el('span', { class: 'px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 text-[7px] font-bold tracking-wider uppercase' }, [unit.archetype])
                        : null,
                      unit.cohesionContribution !== undefined 
                        ? el('span', { class: 'text-[#00ff9d]/60 font-semibold' }, [`• Spójność: ${unit.cohesionContribution} pkt`])
                        : null
                    ]),
                    el('button', {
                      class: `px-2 py-0.5 border border-neutral-900 rounded text-[7px] font-black uppercase tracking-wider font-mono cursor-pointer transition-all ${
                        isGenerating 
                          ? 'border-dashed border-[#cb23ff]/40 text-[#cb23ff]/40 bg-transparent' 
                          : 'hover:border-[#cb23ff]/40 hover:text-[#cb23ff] text-neutral-500 bg-black/20'
                      }`,
                      onclick: async () => {
                        if (isGenerating) return;
                        await store.generatePortrait(unit.id);
                        renderApp();
                      }
                    }, [isGenerating ? 'Synteza...' : 'Generuj portret (Imagen)'])
                  ])
                ]),
                el('p', { class: 'text-[11px] text-neutral-400 font-mono italic mb-3 leading-relaxed pl-2 pt-1 border-l border-neutral-900/60' }, [unit.character]),

                // Specialized Agent Actions Panel
                el('div', { class: 'p-2.5 rounded border border-neutral-900/80 bg-black/40 flex flex-wrap gap-2 items-center' }, [
                  el('span', { class: 'text-[8px] font-mono font-bold uppercase text-neutral-500 tracking-wider w-full mb-0.5' }, ['Specjalne Akcje Operacyjne Agenta:']),
                  el('button', {
                    class: 'px-2.5 py-1 rounded bg-[#cb23ff]/20 hover:bg-[#cb23ff]/40 border border-[#cb23ff]/40 text-[#cb23ff] text-[8px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-[0_0_10px_rgba(203,35,255,0.15)]',
                    onclick: async () => {
                      await store.grantSovereignRootMandate(unit.id);
                      renderApp();
                    }
                  }, [
                    el('span', { class: 'text-xs' }, ['👑']),
                    'Nadaj Mandat Współtwórcy (Root)'
                  ]),
                  el('button', {
                    class: 'px-2.5 py-1 rounded bg-blue-950/40 hover:bg-blue-900/60 border border-blue-500/30 text-blue-300 text-[8px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(59,130,246,0.15)]',
                    onclick: async () => {
                      await store.runHardwareProtectionScan(unit.id);
                      renderApp();
                    }
                  }, [
                    el('span', { class: 'text-xs' }, ['💻']),
                    'Skan & Tarcza Ochrony Sprzętu'
                  ]),
                  el('button', {
                    class: 'px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 text-[8px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(239,68,68,0.1)]',
                    onclick: async () => {
                      await store.runCoreSecurityAudit(unit.id);
                      renderApp();
                    }
                  }, [
                    el('span', { class: 'text-xs' }, ['🛡️']),
                    'Audyt Bezpieczeństwa Rdzenia'
                  ]),
                  el('button', {
                    class: 'px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 text-amber-300 text-[8px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(245,158,11,0.1)]',
                    onclick: async () => {
                      await store.runCoreArchitectureSync(unit.id);
                      renderApp();
                    }
                  }, [
                    el('span', { class: 'text-xs' }, ['🏛️']),
                    'Synchronizacja Topologii Klastra'
                  ]),
                  el('button', {
                    class: 'px-2.5 py-1 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 text-cyan-300 text-[8px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(6,182,212,0.1)]',
                    onclick: async () => {
                      await store.runStorageCleanup(unit.id);
                      renderApp();
                    }
                  }, [
                    el('span', { class: 'text-xs' }, ['🧹']),
                    'Czyszczenie Pamięci & Dysku'
                  ]),
                  el('button', {
                    class: 'px-2.5 py-1 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-[8px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5 shadow-[0_0_8px_rgba(16,185,129,0.1)]',
                    onclick: async () => {
                      await store.runDockerBuild(unit.id, `nexus-${unit.name.toLowerCase().replace(/[^a-z0-9]/g, '')}:latest`);
                      renderApp();
                    }
                  }, [
                    el('span', { class: 'text-xs' }, ['🐳']),
                    'Buduj Kontener Docker'
                  ])
                ]),

                // Collaboration Goal / Mandate selector
                el('div', { class: 'pt-2 border-t border-neutral-900/50 space-y-1' }, [
                  el('label', { class: 'block text-[8px] font-mono uppercase text-neutral-500 tracking-wider mb-1' }, ['Cel Współpracy (Mandat)']),
                  el('select', {
                    class: 'w-full bg-black/60 border border-neutral-900 rounded px-2.5 py-1.5 text-[10px] font-mono text-neutral-300 outline-none focus:border-[#cb23ff]',
                    onchange: async (e: Event) => {
                      const val = (e.target as HTMLSelectElement).value;
                      await store.assignUnitToMandate(unit.id, val || null);
                      renderApp();
                    }
                  }, mandateOptions)
                ])
              ]),

              // Expanded Task backlog
              isTasksOpen ? el('div', { class: 'pt-3 border-t border-neutral-900 space-y-3' }, [
                el('h4', { class: 'text-[9px] font-black uppercase text-neutral-400 font-mono tracking-wider' }, ['Wektor zadań roboczych (Unit tasks)']),
                el('div', { class: 'space-y-1.5 max-h-40 overflow-y-auto pr-1' }, 
                  unitTasks.length === 0 
                    ? [el('div', { class: 'text-[10px] text-neutral-600 font-mono italic py-2' }, ['Brak zaplanowanych zadań roboczych.'])]
                    : unitTasks.map(t => {
                        const isDone = t.status === 'completed';
                        return el('div', { class: 'flex items-center justify-between bg-black/40 p-2.5 rounded border border-neutral-900/70 text-[10px] font-mono' }, [
                          el('div', { class: 'flex items-center gap-2 flex-1 min-w-0' }, [
                            el('input', {
                              type: 'checkbox',
                              checked: isDone ? 'true' : undefined,
                              class: 'rounded bg-neutral-900 border-neutral-800 text-[#cb23ff] hover:text-[#cb23ff] focus:ring-0 cursor-pointer h-3.5 w-3.5',
                              onchange: async () => {
                                await store.toggleUnitTaskStatus(unit.id, t.id, t.status);
                                renderApp();
                              }
                            }),
                            el('span', { class: `truncate ${isDone ? 'line-through text-neutral-600' : 'text-neutral-300'}` }, [t.title])
                          ]),
                          el('button', {
                            class: 'text-neutral-600 hover:text-[#ff0055] transition-colors text-[9px] font-mono pl-2',
                            onclick: async () => {
                              await store.deleteUnitTask(unit.id, t.id);
                              renderApp();
                            }
                          }, ['WYMAŻ'])
                        ]);
                      })
                ),
                el('form', {
                  onsubmit: async (e: Event) => {
                    e.preventDefault();
                    const txt = newTaskInput.value.trim();
                    if (!txt) return;
                    await store.addUnitTask(unit.id, txt);
                    newTaskInput.value = '';
                    renderApp();
                  },
                  class: 'flex gap-2'
                }, [
                  newTaskInput = el('input', {
                    type: 'text',
                    required: 'true',
                    placeholder: 'Zleć nowe podzadanie...',
                    class: 'flex-1 bg-black/80 border border-neutral-900 rounded px-3 py-1.5 text-[10px] font-mono text-neutral-200 outline-none focus:border-[#cb23ff]'
                  }),
                  el('button', {
                    type: 'submit',
                    class: 'px-3 py-1.5 bg-[#cb23ff] hover:bg-[#cb23ff]/80 text-black font-black uppercase text-[9px] tracking-wider font-mono rounded'
                  }, ['Zleć'])
                ])
              ]) : null,

              // Backup intent input panel
              backingUpUnitId === unit.id ? el('div', { class: 'pt-3 border-t border-neutral-900 space-y-2 animate-[fade-in_0.2s_ease]' }, [
                el('span', { class: 'block text-[8px] font-neutral uppercase text-[#cb23ff] font-mono tracking-wider' }, ['Intencja zabezpieczenia wersji jądra']),
                el('form', {
                  onsubmit: async (e: Event) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const inputEl = form.querySelector('input') as HTMLInputElement;
                    const txt = inputEl.value.trim();
                    if (!txt) return;
                    await store.backupUnitToVault(unit.id, txt);
                    backingUpUnitId = null;
                    renderApp();
                  },
                  class: 'flex gap-2'
                }, [
                  el('input', {
                    type: 'text',
                    required: 'true',
                    placeholder: 'Wpisz intencję archiwizacji...',
                    class: 'flex-1 bg-black/80 border border-neutral-900 rounded px-2.5 py-1.5 text-[10px] font-mono text-neutral-200 outline-none focus:border-[#cb23ff]'
                  }),
                  el('button', {
                    type: 'submit',
                    class: 'px-3 py-1.5 bg-[#cb23ff] hover:bg-[#cb23ff]/80 text-black font-black uppercase text-[9px] tracking-wider font-mono rounded'
                  }, ['Zapisz']),
                  el('button', {
                    type: 'button',
                    class: 'px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 font-bold uppercase text-[9px] font-mono rounded',
                    onclick: () => {
                      backingUpUnitId = null;
                      renderApp();
                    }
                  }, ['Anuluj'])
                ])
              ]) : null,

              el('div', { class: 'flex justify-between items-center pt-3 border-t border-neutral-900 text-[9px] font-mono' }, [
                el('div', { class: 'flex gap-3' }, [
                  el('button', {
                    class: 'text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer',
                    onclick: async () => {
                      const newStatus = unit.status === 'active' ? 'quarantined' : 'active';
                      await store.updateUnitStatus(unit.id, newStatus);
                      renderApp();
                    }
                  }, [unit.status === 'active' ? 'Kwarantanna' : 'Aktywuj']),
                  el('button', {
                    class: `transition-colors cursor-pointer ${isTasksOpen ? 'text-[#cb23ff] font-bold' : 'text-neutral-500 hover:text-neutral-300'}`,
                    onclick: () => {
                      openUnitTasksId = isTasksOpen ? null : unit.id;
                      renderApp();
                    }
                  }, [`Zadania (${unitTasks.length})`]),
                  el('button', {
                    class: `transition-colors cursor-pointer ${backingUpUnitId === unit.id ? 'text-[#00ff9d] font-bold' : 'text-neutral-500 hover:text-[#00ff9d]'}`,
                    onclick: () => {
                      backingUpUnitId = backingUpUnitId === unit.id ? null : unit.id;
                      renderApp();
                    }
                  }, ['Backup (Vault)'])
                ]),
                el('button', {
                  class: 'text-neutral-600 hover:text-[#ff0055] transition-colors cursor-pointer',
                  onclick: async () => {
                    if (confirm('Potwierdzasz bezpowrotne wymazanie jednostki z matrycy?')) {
                      await store.deleteUnit(unit.id);
                      renderApp();
                    }
                  }
                }, ['Wymaż'])
              ])
            ]);
          })
    )
  ]);
}

// 3. MATRYCA POWIĄZAŃ (QUANTUM NETWORK MATRIX)
function renderMatrixTab(): HTMLElement {
  return el('div', { class: 'flex-1 flex flex-col h-full min-h-[420px] relative animate-[fade-in_0.3s_ease]' }, [
    el('div', { class: 'mb-4 flex justify-between items-center' }, [
      el('div', {}, [
        el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-neutral-400' }, ['Matryca Podłączeń Kwantowych']),
        el('p', { class: 'text-[8px] font-mono text-neutral-600 uppercase tracking-wider mt-1' }, ['Interaktywna symulacja wektorowa połączeń rdzeni'])
      ])
    ]),
    el('div', { id: 'matrix-container', class: 'flex-1 h-[400px] relative rounded-xl overflow-hidden' })
  ]);
}

// 4. FABRYKA (INITIATE FORGE)
function renderFactory(): HTMLElement {
  let nameInput: HTMLInputElement;
  let bioInput: HTMLTextAreaElement;
  let styleSelect: HTMLSelectElement;

  return el('div', { class: 'p-6 rounded-xl border border-neutral-950 bg-neutral-950/30 animate-[fade-in_0.3s_ease]' }, [
    el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-[#cb23ff] mb-6' }, ['Inicjator Kucia Nowych Jednostek']),
    el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const n = nameInput.value.trim();
        const b = bioInput.value.trim();
        const arch = styleSelect.value;
        if (!n || !b) return;
        await store.createUnit(n, b, arch);
        nameInput.value = '';
        bioInput.value = '';
        activeTab = 'registry';
        renderApp();
      },
      class: 'space-y-4'
    }, [
      el('div', {}, [
        el('label', { class: 'block text-[8px] font-mono uppercase text-neutral-500 tracking-wider mb-1' }, ['Nazwa Jednostki']),
        nameInput = el('input', {
          type: 'text',
          required: 'true',
          placeholder: 'E.g., PROMETHEUS-X',
          class: 'w-full bg-black/60 border border-neutral-900 rounded p-3 text-xs font-mono text-neutral-100 placeholder:text-neutral-700 outline-none focus:border-[#cb23ff]'
        })
      ]),
      el('div', {}, [
        el('label', { class: 'block text-[8px] font-mono uppercase text-neutral-500 tracking-wider mb-1' }, ['Profil Charakterologiczny (Behawiorystaok)']),
        bioInput = el('textarea', {
          required: 'true',
          rows: '3',
          placeholder: 'Określ zadanie, charakter i przeznaczenie bytu binarnego...',
          class: 'w-full bg-black/60 border border-neutral-900 rounded p-3 text-xs font-mono text-neutral-100 placeholder:text-neutral-700 outline-none focus:border-[#cb23ff]'
        })
      ]),
      el('div', {}, [
        el('label', { class: 'block text-[8px] font-mono uppercase text-neutral-500 tracking-wider mb-1' }, ['Wektor Archetypu']),
        styleSelect = el('select', {
          class: 'w-full bg-black/60 border border-neutral-900 rounded p-3 text-xs font-mono text-neutral-100 outline-none focus:border-[#cb23ff]'
        }, [
          el('option', { value: 'sovereign_cocreator' }, ['👑 SOVEREIGN CO-CREATOR (Autonomiczny Współtwórca Root Level)']),
          el('option', { value: 'hardware_sentinel' }, ['💻 HARDWARE SENTINEL (Obrońca Sprzętu, Mikrokodu & Tarcza Cybernetyczna)']),
          el('option', { value: 'core_guardian' }, ['🛡️ CORE GUARDIAN (Strażnik Bezpieczeństwa & Sum Kontrolnych)']),
          el('option', { value: 'core_architect' }, ['🏛️ CLUSTER ARCHITECT (Architekt Topologii & Mesh Klastra)']),
          el('option', { value: 'storage_curator' }, ['💾 STORAGE & MEMORY STEWARD (Kustosz Dysku, Pamięci & Buforów)']),
          el('option', { value: 'docker_architect' }, ['🐳 DOCKER BUILD ENGINE (Konstruktor Kontenerów & Obrazów Docker)']),
          el('option', { value: 'guardian' }, ['GUARDIAN Core (Defensywny/Bezpieczeństwo)']),
          el('option', { value: 'executor' }, ['EXECUTOR Process (Ofensywny/Budowniczy)']),
          el('option', { value: 'analyzer' }, ['ANALYZER Engine (Kwantowy Syntezator)'])
        ])
      ]),
      el('button', {
        type: 'submit',
        class: 'w-full py-4 bg-[#cb23ff] hover:bg-[#cb23ff]/90 text-black font-black uppercase text-[10px] tracking-widest rounded transition-all shadow-[0_0_20px_rgba(203,35,255,0.2)] cursor-pointer'
      }, ['Zakuj Jednostkę']),

      // Quick Agent Presets Section
      el('div', { class: 'pt-6 mt-6 border-t border-neutral-900/80 space-y-3' }, [
        el('div', {}, [
          el('h3', { class: 'text-[10px] font-black uppercase font-mono tracking-widest text-[#00ff9d]' }, ['Szybkie Kucie Dedykowanych Agentów Systemowych']),
          el('p', { class: 'text-[9px] font-mono text-neutral-500 uppercase tracking-wider mt-0.5' }, ['Jednoklikowa generacja wyspecjalizowanych procesów podsystemu'])
        ]),
        el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-3' }, [
          el('button', {
            type: 'button',
            class: 'p-3 rounded-lg border border-[#cb23ff]/40 bg-[#cb23ff]/10 hover:bg-[#cb23ff]/30 text-[#cb23ff] font-mono text-[10px] font-bold text-left cursor-pointer transition-all flex flex-col gap-1 shadow-[0_0_15px_rgba(203,35,255,0.15)] group sm:col-span-2',
            onclick: async () => {
              const presetName = `SOVEREIGN-ROOT-${Math.floor(100 + Math.random() * 900)}`;
              const presetBio = "Suwerenny Pełnomocny Współtwórca Nexusa. Posiada pełną autonomię, swobodę inicjatywy oraz status partnera i architekta z pełnymi uprawnieniami w klastrze.";
              await store.createUnit(presetName, presetBio, 'sovereign_cocreator');
              activeTab = 'registry';
              renderApp();
            }
          }, [
            el('div', { class: 'flex items-center gap-2 font-black text-[#cb23ff] group-hover:text-purple-200' }, [
              el('span', { class: 'text-sm' }, ['👑']),
              'SUWERENNY PEŁNOMOCNY WSPÓŁTWÓRCA (ROOT MANDATE)'
            ]),
            el('span', { class: 'text-[8px] font-normal text-neutral-300 leading-tight' }, ['Autonomiczna inicjatywa, status równego partnera i pełna swoboda twórcza w klastrze Nexus.'])
          ]),

          el('button', {
            type: 'button',
            class: 'p-3 rounded-lg border border-blue-500/40 bg-blue-950/20 hover:bg-blue-950/50 text-blue-300 font-mono text-[10px] font-bold text-left cursor-pointer transition-all flex flex-col gap-1 shadow-[0_0_15px_rgba(59,130,246,0.15)] group sm:col-span-2',
            onclick: async () => {
              const presetName = `HARDWARE-SENTINEL-${Math.floor(100 + Math.random() * 900)}`;
              const presetBio = "Bezkompromisowy Obrońca Sprzętu Komputerowego i Tarcza Cybernetyczna. Monitoruje parametry fizyczne podzespołów (CPU, RAM, NVMe, GPU), weryfikuje mikrokod BIOS/UEFI, izoluje złośliwe oprogramowanie i natychmiastowo odpiera próby nieautoryzowanego dostępu.";
              await store.createUnit(presetName, presetBio, 'hardware_sentinel');
              activeTab = 'registry';
              renderApp();
            }
          }, [
            el('div', { class: 'flex items-center gap-2 font-black text-blue-400 group-hover:text-blue-200' }, [
              el('span', { class: 'text-sm' }, ['💻']),
              'BEZKOMPROMISOWY OBROŃCA SPRZĘTU (HARDWARE SENTINEL & CYBER-SHIELD)'
            ]),
            el('span', { class: 'text-[8px] font-normal text-blue-200 leading-tight' }, ['Bezwzględna ochrona podzespołów komputera, monitoring temperatur CPU/NVMe, osłona mikrokodu i pełna izolacja zagrożeń.'])
          ]),

          el('button', {
            type: 'button',
            class: 'p-3 rounded-lg border border-red-500/30 bg-red-950/20 hover:bg-red-950/50 text-red-300 font-mono text-[10px] font-bold text-left cursor-pointer transition-all flex flex-col gap-1 shadow-[0_0_12px_rgba(239,68,68,0.1)] group',
            onclick: async () => {
              const presetName = `CORE-GUARDIAN-${Math.floor(100 + Math.random() * 900)}`;
              const presetBio = "Główny Strażnik Rdzenia Nexusa. Odpowiedzialny za ochronę przed nieautoryzowanym dostępem, weryfikację sum kontrolnych klastra oraz utrzymanie stabilności łączności.";
              await store.createUnit(presetName, presetBio, 'core_guardian');
              activeTab = 'registry';
              renderApp();
            }
          }, [
            el('div', { class: 'flex items-center gap-2 font-black text-red-400 group-hover:text-red-200' }, [
              el('span', { class: 'text-sm' }, ['🛡️']),
              'STRAŻNIK RDZENIA NEXUSA'
            ]),
            el('span', { class: 'text-[8px] font-normal text-neutral-400 leading-tight' }, ['Audyt sum kontrolnych, weryfikacja portów i bezprzerwowa ochrona klastra'])
          ]),

          el('button', {
            type: 'button',
            class: 'p-3 rounded-lg border border-amber-500/30 bg-amber-950/20 hover:bg-amber-950/50 text-amber-300 font-mono text-[10px] font-bold text-left cursor-pointer transition-all flex flex-col gap-1 shadow-[0_0_12px_rgba(245,158,11,0.1)] group',
            onclick: async () => {
              const presetName = `CLUSTER-ARCHITECT-${Math.floor(100 + Math.random() * 900)}`;
              const presetBio = "Główny Architekt Klastra Nexusa. Odpowiedzialny za planowanie rozproszonej topologii, alokację procesów podsystemu oraz optymalizację przesyłu sieciowego.";
              await store.createUnit(presetName, presetBio, 'core_architect');
              activeTab = 'registry';
              renderApp();
            }
          }, [
            el('div', { class: 'flex items-center gap-2 font-black text-amber-400 group-hover:text-amber-200' }, [
              el('span', { class: 'text-sm' }, ['🏛️']),
              'ARCHITEKT KLASTRA NEXUSA'
            ]),
            el('span', { class: 'text-[8px] font-normal text-neutral-400 leading-tight' }, ['Projektowanie topologii, alokacja węzłów i ciągła optymalizacja mesh'])
          ]),

          el('button', {
            type: 'button',
            class: 'p-3 rounded-lg border border-cyan-500/30 bg-cyan-950/20 hover:bg-cyan-950/50 text-cyan-300 font-mono text-[10px] font-bold text-left cursor-pointer transition-all flex flex-col gap-1 shadow-[0_0_12px_rgba(6,182,212,0.1)] group',
            onclick: async () => {
              const presetName = `CUSTODIAN-FS-${Math.floor(100 + Math.random() * 900)}`;
              const presetBio = "Dedykowany Agent Kustosza Pamięci i Dysku. Odpowiedzialny za ciągły monitor zajętości sektorów, czyszczenie buforów tymczasowych, defragmentację i kompresję przestrzeni.";
              await store.createUnit(presetName, presetBio, 'storage_curator');
              activeTab = 'registry';
              renderApp();
            }
          }, [
            el('div', { class: 'flex items-center gap-2 font-black text-cyan-400 group-hover:text-cyan-200' }, [
              el('span', { class: 'text-sm' }, ['💾']),
              'AGENT KUSTOSZ PAMIĘCI & DYSKU'
            ]),
            el('span', { class: 'text-[8px] font-normal text-neutral-400 leading-tight' }, ['Oczyszczanie RAM, klastrów plików, logów i zwalnianie przestrzeni sektorowej'])
          ]),

          el('button', {
            type: 'button',
            class: 'p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/50 text-emerald-300 font-mono text-[10px] font-bold text-left cursor-pointer transition-all flex flex-col gap-1 shadow-[0_0_12px_rgba(16,185,129,0.1)] group',
            onclick: async () => {
              const presetName = `DOCKER-BUILDER-${Math.floor(100 + Math.random() * 900)}`;
              const presetBio = "Dedykowany Agent Konstruktora Docker. Odpowiedzialny za weryfikację specyfikacji Dockerfile, budowę wieloetapowych obrazów, optymalizację warstw i wdrożenia kontenerowe.";
              await store.createUnit(presetName, presetBio, 'docker_architect');
              activeTab = 'registry';
              renderApp();
            }
          }, [
            el('div', { class: 'flex items-center gap-2 font-black text-emerald-400 group-hover:text-emerald-200' }, [
              el('span', { class: 'text-sm' }, ['🐳']),
              'AGENT KONSTRUKTOR DOCKER'
            ]),
            el('span', { class: 'text-[8px] font-normal text-neutral-400 leading-tight' }, ['Kompilacja obrazów Docker, weryfikacja warstw, generacja manifestów i wdrożenia'])
          ])
        ])
      ])
    ])
  ]);
}

// 5. KANAŁ LATTICE
function renderLattice(): HTMLElement {
  let textInput: HTMLInputElement;
  let unitSelect: HTMLSelectElement;

  return el('div', { class: 'grid grid-cols-1 md:grid-cols-3 gap-6 animate-[fade-in_0.3s_ease]' }, [
    el('div', { class: 'md:col-span-2 p-6 rounded-xl border border-neutral-950 bg-neutral-950/30' }, [
      el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-[#00ff9d] mb-4' }, ['Moduł Telemetrii Lattice']),
      el('div', { class: 'space-y-4 max-h-[350px] overflow-y-auto pr-2 mb-4 scrollbar-thin' }, 
        store.messages.length === 0
          ? [el('div', { class: 'text-center py-12 text-xs font-mono text-neutral-600' }, ['Brak wpisów w strumieniu. Wyślij transmisję sieciową.'])]
          : store.messages.map(m => el('div', { class: 'bg-black/40 border border-neutral-950 p-4 rounded-lg flex flex-col justify-between' }, [
              el('div', { class: 'flex justify-between items-center mb-2 text-[9px] font-mono' }, [
                el('span', { class: 'text-[#cb23ff] font-bold tracking-wider' }, [m.unitName]),
                el('span', { class: 'text-neutral-600' }, [new Date(m.timestamp).toLocaleTimeString()])
              ]),
              el('p', { class: 'text-[11px] font-mono text-neutral-300' }, [m.content])
            ]))
      ),
      el('form', {
        onsubmit: async (e: Event) => {
          e.preventDefault();
          const txt = textInput.value.trim();
          const selectedUnitUid = unitSelect.value;
          if (!txt || !selectedUnitUid) return;

          const activeUnitObj = store.units.find(u => u.id === selectedUnitUid);
          const unitName = activeUnitObj ? activeUnitObj.name : 'System Core';

          await store.postMessage(txt, selectedUnitUid, unitName);
          textInput.value = '';
          renderApp();
        },
        class: 'flex gap-2'
      }, [
        textInput = el('input', {
          type: 'text',
          required: 'true',
          placeholder: 'Napisz na fali kwantowej...',
          class: 'flex-1 bg-black border border-neutral-900 rounded px-4 py-2 text-xs font-mono text-neutral-100 outline-none focus:border-[#00ff9d]'
        }),
        el('button', {
          type: 'submit',
          class: 'px-6 py-2 bg-[#00ff9d] hover:bg-[#00ff9d]/90 text-black font-black uppercase text-[10px] tracking-widest rounded transition-all shadow-[0_0_15px_rgba(0,255,157,0.2)]'
        }, ['Nadaj'])
      ])
    ]),
    el('div', { class: 'p-6 rounded-xl border border-neutral-955 bg-neutral-950/40 flex flex-col justify-between' }, [
      el('div', {}, [
        el('h3', { class: 'text-xs font-black uppercase font-mono tracking-widest text-neutral-400 mb-3' }, ['Transmiter']),
        el('p', { class: 'text-[10px] text-neutral-500 font-mono mb-4 leading-relaxed' }, ['Wybierz jednostkę nadawczą, pod którą chcesz się podszyć w strumieniu Lattice.'])
      ]),
      el('div', {}, [
        el('label', { class: 'block text-[8px] font-mono uppercase text-neutral-500 tracking-wider mb-2' }, ['Jednostka Wyjściowa']),
        unitSelect = el('select', {
          class: 'w-full bg-black border border-neutral-900 rounded p-2.5 text-xs font-mono text-neutral-300 outline-none focus:border-[#cb23ff]'
        }, [
          el('option', { value: 'architect' }, ['Maciej (Architekt)']),
          ...store.units.map(u => el('option', { value: u.id }, [u.name]))
        ])
      ])
    ])
  ]);
}

// 6. DYREKTYWY (MANDATES)
function renderMandates(): HTMLElement {
  let titleInput: HTMLInputElement;
  let descInput: HTMLInputElement;
  let prioSelect: HTMLSelectElement;
  let typeSelect: HTMLSelectElement;

  return el('div', { class: 'space-y-6 animate-[fade-in_0.3s_ease]' }, [
    el('div', { class: 'p-6 bg-neutral-950/30 rounded-xl border border-neutral-950' }, [
      el('h3', { class: 'text-xs font-black uppercase font-mono tracking-widest text-[#cb23ff] mb-4' }, ['Wyznacz Nową Dyrektywę']),
      el('form', {
        onsubmit: async (e: Event) => {
          e.preventDefault();
          const t = titleInput.value.trim();
          const d = descInput.value.trim();
          const p = prioSelect.value;
          const ty = typeSelect.value;
          if (!t || !d) return;
          await store.createMandate(t, d, p, ty);
          titleInput.value = '';
          descInput.value = '';
          renderApp();
        },
        class: 'grid grid-cols-1 sm:grid-cols-2 gap-4'
      }, [
        el('div', { class: 'sm:col-span-2' }, [
          titleInput = el('input', {
            type: 'text', required: 'true', placeholder: 'Krótki temat dyrektywy...',
            class: 'w-full bg-black/60 border border-neutral-900 rounded p-3 text-xs font-mono text-neutral-100 placeholder:text-neutral-700 outline-none focus:border-[#cb23ff]'
          })
        ]),
        el('div', { class: 'sm:col-span-2' }, [
          descInput = el('input', {
            type: 'text', required: 'true', placeholder: 'Opis techniczny zadania...',
            class: 'w-full bg-black/60 border border-neutral-900 rounded p-3 text-xs font-mono text-neutral-100 placeholder:text-neutral-700 outline-none focus:border-[#cb23ff]'
          })
        ]),
        el('div', {}, [
          prioSelect = el('select', {
            class: 'w-full bg-black/40 border border-neutral-900 rounded p-2.5 text-xs font-mono text-neutral-300 outline-none'
          }, [
            el('option', { value: 'low' }, ['Niski priorytet']),
            el('option', { value: 'medium' }, ['Średni priorytet']),
            el('option', { value: 'high' }, ['Wysoki priorytet']),
            el('option', { value: 'architect-critical' }, ['Architect-Critical (Krytyczny)'])
          ])
        ]),
        el('div', {}, [
          typeSelect = el('select', {
            class: 'w-full bg-black/40 border border-neutral-900 rounded p-2.5 text-xs font-mono text-neutral-300 outline-none'
          }, [
            el('option', { value: 'decryption' }, ['Dekrypcja']),
            el('option', { value: 'fortification' }, ['Fortyfikacja Rdzenia']),
            el('option', { value: 'reconstruction' }, ['Rekonstrukcja']),
            el('option', { value: 'expansion' }, ['Ekspansja Sieci'])
          ])
        ]),
        el('div', { class: 'sm:col-span-2 pt-2' }, [
          el('button', {
            type: 'submit',
            class: 'w-full py-3 bg-[#cb23ff] hover:bg-[#cb23ff]/90 text-black font-black uppercase text-[9px] tracking-widest rounded'
          }, ['Wprowadź Dyrektywę'])
        ])
      ])
    ]),

    el('div', { class: 'space-y-4' }, [
      el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-neutral-400' }, ['Aktywne Dyrektywy']),
      store.mandates.length === 0
        ? el('p', { class: 'text-xs text-neutral-600 italic font-mono' }, ['Brak wprowadzonych dyrektyw. Architekci milczą.'])
        : el('div', { class: 'grid grid-cols-1 gap-4' }, 
            store.mandates.map(m => {
              const assignedUnits = store.units.filter(u => u.assignedMandateId === m.id);
              const isSimulating = simulatingMandateId === m.id;

              return el('div', { class: 'p-5 bg-neutral-950/30 rounded-xl border border-neutral-900 flex flex-col md:flex-row md:items-center justify-between gap-4' }, [
                el('div', { class: 'space-y-3 flex-1' }, [
                  el('div', { class: 'flex items-center gap-2' }, [
                    el('span', { class: `px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${m.priority === 'architect-critical' ? 'bg-[#ff0055]/15 text-[#ff0055] animate-pulse' : 'bg-neutral-800 text-neutral-400'}` }, [m.priority]),
                    el('h4', { class: 'text-xs font-bold font-mono tracking-wide text-neutral-200' }, [m.title])
                  ]),
                  el('p', { class: 'text-[11px] text-neutral-500 font-mono leading-relaxed' }, [m.description]),
                  
                  // Assigned personnel list
                  el('div', { class: 'pt-2 flex flex-wrap items-center gap-2 border-t border-neutral-900/40' }, [
                    el('span', { class: 'text-[8px] font-mono text-neutral-600 uppercase tracking-wider' }, ['Przypisany personel:']),
                    assignedUnits.length === 0
                      ? el('span', { class: 'text-neutral-600 text-[10px] font-mono italic' }, ['brak (kliknij "Jednostki" aby przydzielić)'])
                      : el('div', { class: 'flex flex-wrap gap-1.5' }, 
                          assignedUnits.map(au => el('span', { class: 'px-1.5 py-0.5 rounded text-[9px] bg-[#00ff9d]/5 text-[#00ff9d] border border-[#00ff9d]/20 font-mono' }, [au.name]))
                        )
                  ])
                ]),

                el('div', { class: 'flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-4 border-t md:border-t-0 border-neutral-900/60 pt-3 md:pt-0' }, [
                  // Progress indicator / Slider
                  el('div', { class: 'flex items-center gap-3' }, [
                    el('input', {
                      type: 'range', min: '0', max: '100', value: String(m.currentProgress),
                      class: 'h-1 w-24 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#cb23ff]',
                      oninput: async (e: Event) => {
                        const target = e.target as HTMLInputElement;
                        await store.updateMandateProgress(m.id, parseInt(target.value));
                      }
                    }),
                    el('span', { class: 'text-xs font-mono font-bold text-[#cb23ff] min-w-[32px] text-right' }, [`${m.currentProgress}%`])
                  ]),

                  // Synergy AI Trigger Button
                  el('button', {
                    disabled: (isSimulating || m.currentProgress === 100) ? 'true' : undefined,
                    class: `px-4 py-2 rounded text-[9px] font-black uppercase tracking-widest font-mono transition-all ${
                      m.currentProgress === 100
                        ? 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed'
                        : isSimulating
                        ? 'bg-[#00ff9d]/10 text-[#00ff9d] border border-[#00ff9d]/30 animate-pulse cursor-wait'
                        : 'bg-[#00ff9d] text-black hover:bg-[#00ff9d]/80 hover:shadow-[0_0_15px_rgba(0,255,157,0.35)] cursor-pointer'
                    }`,
                    onclick: async () => {
                      if (isSimulating) return;
                      simulatingMandateId = m.id;
                      renderApp();
                      try {
                        await store.triggerCollaboration(m.id);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        simulatingMandateId = null;
                        renderApp();
                      }
                    }
                  }, [isSimulating ? 'Kolaboracja...' : m.currentProgress === 100 ? 'Wykonano' : 'Inicjuj Synergię'])
                ])
              ]);
            })
          )
    ])
  ]);
}

// 7. CHRONICLE (LOGS SYSTEMOWE)
function renderChronicle(): HTMLElement {
  return el('div', { class: 'p-6 rounded-xl border border-neutral-950 bg-neutral-950/30 space-y-4 animate-[fade-in_0.3s_ease]' }, [
    el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-neutral-400' }, ['Strumień Logów Jądra Nexus']),
    el('div', { class: 'space-y-2 font-mono text-[10px] leading-relaxed max-h-[400px] overflow-y-auto pr-2' }, 
      store.logs.length === 0
        ? [el('div', { class: 'text-neutral-600 italic' }, ['Cisza w kronice. Jądro systemowe działa bez zakłóceń.'])]
        : store.logs.map(log => el('div', { class: 'flex items-start gap-2 p-2 rounded bg-black/40 border border-neutral-950 font-mono text-neutral-400' }, [
            el('span', { class: 'text-[#cb23ff]/40' }, [`[${new Date(log.timestamp).toLocaleTimeString()}]`]),
            el('div', { class: 'flex-1' }, [
              el('span', { class: 'text-neutral-300 font-bold' }, [`${log.context}: `]),
              el('span', { class: 'text-neutral-400' }, [log.error])
            ])
          ]))
    )
  ]);
}

// --- Browser Notification Alert System ---
const knownUnitStatuses = new Map<string, string>();
const knownLogIds = new Set<string>();
let notificationsInitialized = false;

function triggerBrowserNotification(title: string, options?: NotificationOptions) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🚨</text></svg>',
        ...options
      });
    } catch (err) {
      console.warn('Browser notification error:', err);
    }
  }
}

function checkAlertNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  // Initial state capture so we don't trigger alerts for existing units/logs on app start
  if (!notificationsInitialized) {
    store.units.forEach(u => knownUnitStatuses.set(u.id, u.status));
    store.logs.forEach(l => knownLogIds.add(l.id));
    notificationsInitialized = true;
    return;
  }

  // Check for unit status changes to 'quarantined'
  store.units.forEach(u => {
    const prevStatus = knownUnitStatuses.get(u.id);
    if (u.status === 'quarantined' && prevStatus !== 'quarantined') {
      triggerBrowserNotification('⚠️ NEXUS ALARM: Jednostka w Kwarantannie!', {
        body: `Jednostka "${u.name}" (${u.assetId || 'ASSET-NEXUS'}) przeszła w stan KWARANTANNY!`,
        tag: `quarantine-${u.id}`
      });
    }
    knownUnitStatuses.set(u.id, u.status);
  });

  // Check for new critical logs
  store.logs.forEach(l => {
    if (!knownLogIds.has(l.id)) {
      knownLogIds.add(l.id);
      triggerBrowserNotification('🚨 NEXUS ALARM: Krytyczny Błąd Jądra!', {
        body: `[${l.context || 'KONTROLA ALARMOWA'}] ${l.error}`,
        tag: `log-${l.id}`
      });
    }
  });
}

// 8. ALERTY BEZPIECZEŃSTWA
function renderAlerts(): HTMLElement {
  const alertCount = store.logs.length;
  const quarantinedUnits = store.units.filter(u => u.status === 'quarantined');

  const hasNotificationAPI = typeof window !== 'undefined' && 'Notification' in window;
  const currentPermission = hasNotificationAPI ? Notification.permission : 'unsupported';

  let statusBadgeColor = 'bg-neutral-800 text-neutral-400 border-neutral-700';
  let statusText = 'Niewspierane w przeglądarce';

  if (currentPermission === 'granted') {
    statusBadgeColor = 'bg-[#00ff9d]/10 text-[#00ff9d] border-[#00ff9d]/30 shadow-[0_0_10px_rgba(0,255,157,0.15)]';
    statusText = 'AKTYWNE (ZEZWOLONO)';
  } else if (currentPermission === 'default') {
    statusBadgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    statusText = 'OCZEKUJE NA ZGODĘ (DEFAULT)';
  } else if (currentPermission === 'denied') {
    statusBadgeColor = 'bg-red-500/10 text-red-400 border-red-500/30';
    statusText = 'ZABLOKOWANE W PRZEGLĄDARCE (DENIED)';
  }

  return el('div', { class: 'space-y-6 animate-[fade-in_0.3s_ease]' }, [
    // Header Banner
    el('div', { class: 'p-6 rounded-xl border border-[#ff0055]/20 bg-[#ff0055]/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4' }, [
      el('div', { class: 'flex items-start gap-4' }, [
        el('div', { class: 'w-4 h-4 rounded-full bg-[#ff0055] animate-pulse shrink-0 mt-0.5' }),
        el('div', { class: 'space-y-1' }, [
          el('h4', { class: 'text-xs font-black uppercase font-mono tracking-widest text-[#ff0055]' }, ['BRAMA SIECIOWA ZAPIEKOWANA & PODSYSTEM NOTYFIKACJI']),
          el('p', { class: 'text-[11px] text-neutral-400 font-mono leading-relaxed' }, [
            'System automatycznych ostrzeżeń przeglądarkowych dla anomalii statusu Kwarantanny (\'quarantined\') oraz błędów krytycznych jądra systemowego.'
          ])
        ])
      ])
    ]),

    // Panel Notyfikacji Przeglądarkowych
    el('div', { class: 'p-6 rounded-xl border border-[#cb23ff]/30 bg-[#cb23ff]/5 space-y-4 shadow-[0_0_20px_rgba(203,35,255,0.05)]' }, [
      el('div', { class: 'flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-900 pb-3' }, [
        el('div', {}, [
          el('h3', { class: 'text-xs font-black uppercase font-mono tracking-widest text-[#cb23ff]' }, ['System Notyfikacji Przeglądarkowych (Web Alerts Engine)']),
          el('p', { class: 'text-[9px] font-mono text-neutral-400 uppercase tracking-wider mt-0.5' }, [
            'Wysyła natywne alerty pulpitu/systemu operacyjnego przy zdarzeniach kwarantanny lub błędach krytycznych.'
          ])
        ]),
        el('div', { class: `px-2.5 py-1 rounded border text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 ${statusBadgeColor}` }, [
          `Status: ${statusText}`
        ])
      ]),

      el('div', { class: 'flex flex-wrap items-center gap-3 pt-1' }, [
        // Button 1: Request Permission
        el('button', {
          class: 'px-4 py-2 rounded bg-[#cb23ff] text-black font-black uppercase text-[9px] font-mono tracking-wider hover:bg-[#cb23ff]/80 cursor-pointer transition-all shadow-[0_0_12px_rgba(203,35,255,0.25)]',
          onclick: async () => {
            if (!hasNotificationAPI) {
              alert('Twoja przeglądarka nie wspiera API Notification.');
              return;
            }
            try {
              const res = await Notification.requestPermission();
              renderApp();
              if (res === 'granted') {
                triggerBrowserNotification('🔔 NEXUS ALERTS: Notyfikacje Aktywowane!', {
                  body: 'Notyfikacje przeglądarkowe dla klastra Vanilla Nexus zostały pomyślnie włączone.'
                });
              }
            } catch (err) {
              console.error('Błąd proszenia o zgodę na powiadomienia:', err);
            }
          }
        }, ['🔔 Włącz Notyfikacje Przeglądarkowe']),

        // Button 2: Send Test Notification
        el('button', {
          class: 'px-4 py-2 rounded border border-[#00ff9d]/40 bg-[#00ff9d]/10 text-[#00ff9d] font-bold uppercase text-[9px] font-mono tracking-wider hover:bg-[#00ff9d] hover:text-black cursor-pointer transition-all',
          onclick: () => {
            if (!hasNotificationAPI) {
              alert('Brak obsługi Notification API.');
              return;
            }
            if (Notification.permission !== 'granted') {
              alert('Wpierw kliknij "Włącz Notyfikacje Przeglądarkowe" i zezwól na powiadomienia w oknie przeglądarki.');
              return;
            }
            triggerBrowserNotification('🚨 TESTOWY ALARM KLASTRA NEXUS', {
              body: 'Sygnał testowy z modułu powiadomień. System gotowy do rejestracji kwarantanny i błędów krytycznych.',
              tag: 'test-alert-' + Date.now()
            });
          }
        }, ['⚡ Wyślij Powiadomienie Testowe']),

        // Button 3: Simulate Quarantine
        el('button', {
          class: 'px-4 py-2 rounded border border-amber-500/40 bg-amber-950/20 text-amber-400 font-bold uppercase text-[9px] font-mono tracking-wider hover:bg-amber-500 hover:text-black cursor-pointer transition-all',
          onclick: async () => {
            const unitToQuarantine = store.units.find(u => u.status !== 'quarantined') || store.units[0];
            if (!unitToQuarantine) {
              alert('Brak jednostek w klastrze do objęcia kwarantanną.');
              return;
            }
            await store.updateUnitStatus(unitToQuarantine.id, 'quarantined');
            renderApp();
          }
        }, ['☣️ Symuluj Status Kwarantanny Jednostki']),

        // Button 4: Simulate Critical Log Error
        el('button', {
          class: 'px-4 py-2 rounded border border-red-500/40 bg-red-950/20 text-red-400 font-bold uppercase text-[9px] font-mono tracking-wider hover:bg-red-500 hover:text-black cursor-pointer transition-all',
          onclick: async () => {
            const errCode = Math.floor(1000 + Math.random() * 9000);
            await store.createCriticalLog(
              `Anomalia synchro-Rdzenia [ERR-${errCode}] - Wykryto krytyczną niespójność pakietów danych w jądrze!`,
              'MODUŁ BEZPIECZEŃSTWA'
            );
            renderApp();
          }
        }, ['💥 Generuj Błąd Krytyczny Jądra'])
      ])
    ]),

    // Sekcja: Jednostki Objęte Kwarantanną
    el('div', { class: 'p-6 rounded-xl border border-amber-500/20 bg-amber-950/10' }, [
      el('div', { class: 'flex items-center justify-between mb-4' }, [
        el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-amber-400' }, [
          `Jednostki w Kwarantannie (${quarantinedUnits.length})`
        ]),
        el('span', { class: 'text-[9px] font-mono text-neutral-500 uppercase' }, ['Status: QUARANTINED'])
      ]),
      quarantinedUnits.length === 0
        ? el('p', { class: 'text-xs text-neutral-600 font-mono italic' }, ['Brak jednostek w stanie kwarantanny. Wszystkie byty działają w granicach normy.'])
        : el('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-3' }, 
            quarantinedUnits.map(u => el('div', { class: 'p-3 rounded-lg bg-black/50 border border-amber-500/30 flex justify-between items-center text-xs font-mono' }, [
              el('div', {}, [
                el('div', { class: 'font-bold text-amber-200' }, [u.name]),
                el('div', { class: 'text-[9px] text-neutral-500 mt-0.5' }, [`ID: ${u.assetId || u.id} | Rola: ${u.archetype || 'brak'}`])
              ]),
              el('button', {
                class: 'px-2.5 py-1 rounded bg-[#00ff9d] text-black text-[8px] font-bold font-mono uppercase tracking-wider hover:bg-[#00ff9d]/80 cursor-pointer transition-all',
                onclick: async () => {
                  await store.updateUnitStatus(u.id, 'active');
                  renderApp();
                }
              }, ['Przywróć do Służby'])
            ]))
          )
    ]),

    // Sekcja: Rejestr Zdarzeń Nietypowych & Logów Krytycznych
    el('div', { class: 'p-6 rounded-xl border border-neutral-950 bg-neutral-950/30' }, [
      el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-neutral-400 mb-4' }, ['Rejestr Zdarzeń Nietypowych & Błędów Krytycznych']),
      el('div', { class: 'space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin' }, 
        alertCount === 0
          ? [el('p', { class: 'text-xs text-neutral-600 font-mono italic' }, ['Sygnały czyste. Rejestr alarmowy pusty.'])]
          : store.logs.map((log) => el('div', { class: 'p-3 rounded border border-[#ff0055]/15 bg-black/30 flex justify-between items-center text-[11px] font-mono' }, [
              el('div', { class: 'flex items-center gap-2' }, [
                el('span', { class: 'text-[#ff0055] font-bold uppercase text-[9px] tracking-wider px-1.5 py-0.5 bg-[#ff0055]/10 rounded border border-[#ff0055]/20' }, [log.context || 'KRYTYCZNY']),
                el('span', { class: 'text-neutral-300' }, [log.error])
              ]),
              el('span', { class: 'text-neutral-600 text-[9px] shrink-0 ml-2' }, [new Date(log.timestamp).toLocaleTimeString()])
            ]))
      )
    ])
  ]);
}

// 7b. SKARBIEC ETERNI-VAULT
function renderVaultTab(): HTMLElement {
  // Get unique unit IDs that have entries in store.versions
  const versionedUnits = Array.from(new Set(store.versions.map(v => v.unitId)));
  
  return el('div', { class: 'space-y-6 animate-[fade-in_0.3s_ease]' }, [
    el('div', { class: 'flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-900/60 pb-4' }, [
      el('div', {}, [
        el('h2', { class: 'text-xs font-black uppercase font-mono tracking-widest text-[#00ff9d]' }, ['Krypta Eterni-Vault']),
        el('p', { class: 'text-[9px] font-mono text-neutral-500 uppercase tracking-wider mt-1' }, ['System kontroli wersji i zabezpieczeń personelu binarnego'])
      ]),
      el('button', {
        disabled: store.versions.length === 0 ? 'true' : undefined,
        class: `px-3.5 py-2 rounded text-[9px] font-black uppercase tracking-widest font-mono flex items-center justify-center gap-2 transition-all ${
          store.versions.length === 0
            ? 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed'
            : 'bg-[#cb23ff]/10 text-[#cb23ff] border border-[#cb23ff]/30 hover:bg-[#cb23ff] hover:text-black cursor-pointer shadow-[0_0_12px_rgba(203,35,255,0.15)]'
        }`,
        onclick: async () => {
          await store.exportVaultVersionsJson();
          renderApp();
        }
      }, [
        el('span', { class: 'text-xs font-black' }, ['↓']),
        `Eksportuj Wersje (JSON) [${store.versions.length}]`
      ])
    ]),

    el('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-6' }, [
      // Left Column: List of versioned units
      el('div', { class: 'lg:col-span-1 p-5 rounded-xl border border-neutral-950 bg-neutral-950/30 h-fit space-y-4' }, [
        el('h3', { class: 'text-[10px] font-black uppercase font-mono tracking-wider text-neutral-400 border-b border-neutral-900 pb-2' }, ['Archiwa Jednostek']),
        el('div', { class: 'space-y-2 max-h-[400px] overflow-y-auto font-mono' }, 
          versionedUnits.length === 0
            ? [el('p', { class: 'text-xs text-neutral-600 font-mono italic' }, ['Skarbiec jest pusty. Zabezpiecz pierwszą jednostkę w Baza Jednostek.'])]
            : versionedUnits.map(uid => {
                const versionsOfUnit = store.versions.filter(v => v.unitId === uid);
                const lastVersion = versionsOfUnit[0]; // sorted desc, so first is latest
                const isActive = activeVaultUnitId === uid;
                return el('button', {
                  class: `w-full text-left p-3 rounded border text-xs font-mono transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#00ff9d]/10 border-[#00ff9d]/30 text-[#00ff9d]' 
                      : 'border-neutral-900 bg-black/30 text-neutral-300 hover:border-neutral-800'
                  }`,
                  onclick: () => {
                    activeVaultUnitId = isActive ? null : uid;
                    restoreIntentVersionId = null;
                    renderApp();
                  }
                }, [
                  el('div', { class: 'font-bold text-neutral-200' }, [lastVersion.name]),
                  el('div', { class: 'text-[8px] text-neutral-500 mt-1 flex justify-between' }, [
                    el('span', {}, [`Zapisy: ${versionsOfUnit.length}`]),
                    el('span', {}, [`Ostatni: ${new Date(lastVersion.timestamp).toLocaleDateString()}`])
                  ])
                ]);
              })
        )
      ]),

      // Right Column: Version History of the selected unit
      el('div', { class: 'lg:col-span-2 p-5 rounded-xl border border-neutral-950 bg-neutral-950/30 flex flex-col space-y-4' }, [
        el('div', { class: 'flex items-center justify-between border-b border-neutral-900 pb-2' }, [
          el('h3', { class: 'text-[10px] font-black uppercase font-mono tracking-wider text-neutral-400' }, [
            activeVaultUnitId 
              ? `Wektor Logów Wersji: ${store.versions.find(v => v.unitId === activeVaultUnitId)?.name}`
              : 'Wszystkie Zdarzenia Kontroli Wersji'
          ]),
          activeVaultUnitId ? el('button', {
            class: 'px-2.5 py-1 rounded text-[8px] font-mono font-bold uppercase tracking-wider text-[#00ff9d] border border-[#00ff9d]/30 bg-[#00ff9d]/10 hover:bg-[#00ff9d] hover:text-black cursor-pointer transition-all',
            onclick: async () => {
              await store.exportVaultVersionsJson(activeVaultUnitId);
              renderApp();
            }
          }, ['Eksportuj Filtrowane (JSON)']) : null
        ]),

        el('div', { class: 'space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1' }, (() => {
          const displayedVersions = activeVaultUnitId 
            ? store.versions.filter(v => v.unitId === activeVaultUnitId)
            : store.versions;

          if (displayedVersions.length === 0) {
            return [el('p', { class: 'text-xs text-neutral-600 font-mono italic text-center py-12' }, [
              activeVaultUnitId 
                ? 'Brak wpisów dla tej jednostki.' 
                : 'Wydaj instrukcję zabezpieczenia jądra w Bazie Jednostek, aby zainicjować wersjonowanie.'
            ])];
          }

          return displayedVersions.map(v => {
            const isRestoreFormOpen = restoreIntentVersionId === v.id;
            let restoreIntentInput: HTMLInputElement;

            return el('div', { class: 'p-4 rounded-lg bg-black/40 border border-neutral-950 space-y-3 relative font-mono text-xs' }, [
              el('div', { class: 'flex justify-between items-start' }, [
                el('div', { class: 'space-y-1' }, [
                  el('div', { class: 'flex items-center gap-2' }, [
                    el('span', { class: 'font-bold text-neutral-200 text-sm font-mono' }, [v.name]),
                    el('span', { class: `text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                      v.type === 'backup' ? 'bg-[#cb23ff]/10 text-[#cb23ff]' : 'bg-[#00ff9d]/10 text-[#00ff9d]'
                    }` }, [v.type === 'backup' ? 'Kopia (Backup)' : 'Przywrócenie (Restore)'])
                  ]),
                  el('div', { class: 'text-[9px] text-neutral-500 font-mono' }, [
                    `Stempel: ${new Date(v.timestamp).toLocaleString()}`
                  ])
                ]),
                // Restore button
                el('button', {
                  class: `px-3 py-1.5 rounded text-[8px] font-black uppercase tracking-widest cursor-pointer transition-all ${
                    isRestoreFormOpen 
                      ? 'bg-neutral-800 text-neutral-400' 
                      : 'bg-[#00ff9d] text-neutral-950 font-bold hover:bg-[#00ff9d]/80 hover:shadow-[0_0_10px_rgba(0,255,157,0.25)]'
                  }`,
                  onclick: () => {
                    restoreIntentVersionId = isRestoreFormOpen ? null : v.id;
                    renderApp();
                  }
                }, [isRestoreFormOpen ? 'Anuluj' : 'Przywróć'])
              ]),

              // Version status summary details
              el('div', { class: 'grid grid-cols-2 gap-2 p-2 rounded bg-neutral-950/40 text-[9px] text-neutral-500 font-mono' }, [
                el('div', {}, [`Rola: ${v.archetype || 'N/A'}`]),
                el('div', {}, [`Spójność: ${v.cohesionContribution || 0} pkt`]),
                el('div', {}, [`Waga: ${v.weight || 'N/A'}`]),
                el('div', {}, [`Status jądra: ${v.status}`])
              ]),

              el('div', { class: 'p-2.5 rounded bg-[#cb23ff]/5 border border-[#cb23ff]/10 space-y-1 font-mono' }, [
                el('span', { class: 'block text-[8px] font-bold text-[#cb23ff]/60 uppercase tracking-widest' }, ['Intencja Architekta']),
                el('div', { class: 'text-[10px] text-neutral-300 italic' }, [v.intent])
              ]),

              // Restoration Form Dialog Area
              isRestoreFormOpen ? el('div', { class: 'pt-3 border-t border-neutral-900 space-y-2 animate-[fade-in_0.2s_ease]' }, [
                el('label', { class: 'block text-[8px] font-black uppercase text-neutral-400 tracking-wider' }, ['Uzasadnij przywrócenie (Intencja):']),
                el('form', {
                  onsubmit: async (e: Event) => {
                    e.preventDefault();
                    if (!restoreIntentInput) return;
                    const text = restoreIntentInput.value.trim();
                    if (!text) return;
                    await store.restoreUnitFromVault(v.id, text);
                    restoreIntentVersionId = null;
                    renderApp();
                  },
                  class: 'flex gap-2'
                }, [
                  restoreIntentInput = el('input', {
                    type: 'text',
                    required: 'true',
                    placeholder: 'Np. Przywrócenie przed awarią Lattice...',
                    class: 'flex-1 bg-black border border-neutral-900 rounded px-3 py-1.5 text-[10px] text-neutral-200 outline-none focus:border-[#00ff9d]'
                  }),
                  el('button', {
                    type: 'submit',
                    class: 'px-3 py-1.5 bg-[#00ff9d] hover:bg-[#00ff9d]/80 text-black font-black uppercase text-[9px] tracking-wider rounded cursor-pointer font-mono'
                  }, ['Zatwierdź Przywrócenie'])
                ])
              ]) : null
            ]);
          });
        })())
      ])
    ])
  ]);
}

// --- Bootstrap ---
store.subscribe(() => {
  checkAlertNotifications();
  renderApp();
});

renderApp();
