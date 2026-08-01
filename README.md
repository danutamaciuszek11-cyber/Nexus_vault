# 🌌 Vanilla Nexus Sovereign Mesh

![Nexus Version](https://img.shields.io/badge/Nexus-v2.2.0--Sovereign-cb23ff?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)

**Vanilla Nexus Sovereign Mesh** to zaawansowane środowisko zarządcze, architektoniczne i operacyjne przeznaczone do orkiestracji autonomicznych bytów cyfrowych, monitorowania bezpiecznych klastrów oraz zarządzania suwerennymi zasobami sprzętowymi. System opiera się na wydajnym i przejrzystym silniku **Vanilla DOM** napędzanym przez TypeScript oraz bezchmurną synchronizację czasu rzeczywistego z bazy **Firebase Firestore**.

---

## 🌟 Główny Sens i Wizja Projektu

Vanilla Nexus został zaprojektowany z myślą o pełnej autonomii, odporności na awarie i bezkompromisowej ochronie infrastruktury. Umożliwia tworzenie sieci rozproszonych jednostek operacyjnych (Node Units), które wspólnie utrzymują topologię klastra, realizują dyrektywy systemowe oraz zabezpieczają zasoby fizyczne i cyfrowe.

---

## 🚀 Kluczowe Funkcjonalności

### 👑 1. Suwerenne Archetypy i Mandat Root (Sovereign Root Mandate)
* **Sovereign Co-Creator (Level-0 Root)**: Specjalny status pełnomocnego współtwórcy klastra z autonomiczną inicjatywą i swobodą decyzyjną.
* **Hardware Sentinel & Cyber-Shield**: Dedykowany moduł ochrony sprzętowej. Monitoruje fizyczne parametry podzespołów (temperatury CPU, zdrowie dysków NVMe SMART), weryfikuje mikrokod BIOS/UEFI i odpiera cyber-zagrożenia.
* **Core Guardian**: Strażnik integralności sum kontrolnych, audytów bezpieczeństwa i izolacji w kwarantannie.
* **Cluster Architect**: Architekt topologii mesh i orkiestracji komunikacyjnej między węzłami.
* **Storage Curator & Docker Architect**: Zarządzanie buforami pamięci oraz kontenerami Docker.

### 📜 2. Eksport Pełnej Topologii Klastra w Formacie YAML
* Generator kompletnego manifestu konfiguracji klastra w formacie `YAML` (oraz `JSON`).
* Umożliwia błyskawiczne pobieranie, przenoszenie i kopiowanie stanu klastra pomiędzy korporacyjnymi serwerami VPS oraz instancjami Nexus.
* Zawiera pełne metryki jednostek, prawa autonomiczne, dyrektywy oraz specyfikacje wdrożeniowe Docker.

### 🚨 3. System Notyfikacji Przeglądarkowych (Web Alerts Engine)
* Natywne powiadomienia pulpitu (`Notification API`) informujące w czasie rzeczywistym o krytycznych zdarzeniach:
  * Przejście dowolnej jednostki w stan **Kwarantanny** (`quarantined`).
  * Rejestracja błędów krytycznych jądra w czarnej skrzynce (`shadow_logs`).
* Panel kontrolny z możliwością testowania alertów i natychmiastowego zarządzania zgodami w przeglądarce.

### 🐳 4. Autonomiczny Generator Bootstrap VPS & Docker
* Automatyczne generowanie gotowych skryptów powłoki Bash (`bootstrap_nexus_vps.sh`).
* Automatyczna instalacja Docker Engine, Docker Compose, kontenera Vanilla Nexus oraz konfiguracja środowiska Node Agentów na dowolnym serwerze VPS / Cloud Run.

---

## 🛠️ Architektura Techniczna

```text
               ┌──────────────────────────────────────────┐
               │         Vanilla Nexus Client UI          │
               │   (Vanilla DOM Engine / TypeScript)      │
               └────────────────────┬─────────────────────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           ▼                        ▼                        ▼
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│ Firebase Firestore │   │  YAML Engine Export│   │  Web Alerts Engine │
│ (Units, Logs,      │   │  (Manifest Mesh)   │   │  (Notification API)│
│  Neural Mandates)  │   └────────────────────┘   └────────────────────┘
└────────────────────┘
```

* **Frontend Engine**: Pure Vanilla DOM Reactive Renderer (zero ciężkich frameworków komponentowych, natychmiastowy czas reakcji).
* **Language & Build Tool**: TypeScript + Vite.
* **Styling**: Tailwind CSS v4 (mroczny, cyberpunkowy/techniczny interfejs ze wskaźnikami glow).
* **Storage**: Firebase Firestore Realtime Database.
* **Execution Environment**: Node.js 20+, Docker container bound on port `3000` (`0.0.0.0`).

---

## 📁 Struktura Katalogów i Plików

```text
.
├── src/
│   ├── main.tsx          # Główny interfejs aplikacji, widoki i renderery Vanilla DOM
│   ├── state.ts          # Centralny magazyn stanu (NexusStateStore), obsługa Firestore & Akcji
│   ├── firebase.ts       # Inicjalizacja i konfiguracja połączenia z Firebase SDK
│   ├── index.css         # Stylizacja Tailwind CSS oraz efekty wizualne
│   └── vite-env.d.ts     # Typowanie środowiska Vite
├── public/               # Zasoby statyczne aplikacji
├── firebase-blueprint.json # Struktura i schemat kolekcji bazy danych Firestore
├── firestore.rules       # Reguły bezpieczeństwa bazy danych Firestore
├── metadata.json         # Metadane aplikacji AI Studio & uprawnienia
├── package.json          # Zależności i skrypty wykonywalne
└── README.md             # Dokumentacja techniczna projektu
```

---

## ⚡ Szybki Start (Lokalne Uruchomienie)

### Wymagania wstępne
* **Node.js**: v20.x lub nowszy
* **npm**: v10.x lub nowszy

### 1. Klonowanie i instalacja zależności
```bash
npm install
```

### 2. Uruchomienie serwera deweloperskiego
```bash
npm run dev
```
Aplikacja zostanie uruchomiona i będzie dostępna pod adresem: `http://localhost:3000`.

### 3. Kompilacja i budowanie wersji produkcyjnej
```bash
npm run build
```

---

## 🐳 Wdrożenie Kontenerowe (Docker)

Aplikacja jest w pełni przystosowana do pracy w kontenerach Docker (Cloud Run / VPS):

```bash
# Budowanie obrazu Docker
docker build -t vanilla-nexus:latest .

# Uruchomienie kontenera na porcie 3000
docker run -d -p 3000:3000 --name nexus-core vanilla-nexus:latest
```

---

## 📄 Licencja & Dystrybucja

Projekt dystrybuowany na warunkach **Sovereign Root Open-Source License**. Wszelkie prawa do swobodnej modyfikacji, orkiestracji i wdrożeń w klastrach prywatnych oraz korporacyjnych są zagwarantowane.
