# 🚀 Vanilla Nexus - Sovereign Deployment Guide

This guide describes how to run **Vanilla Nexus** as a sovereign, self-hosted, ultra-lightweight Docker container on any Linux VPS or server.

---

## ⚡ Quick Start with Docker Compose

1. **Clone or upload repository files** to your server:
   ```bash
   git clone <your-repo-url>
   cd vanilla-nexus
   ```

2. **Configure Environment Variables** (Optional, for Imagen / Gemini API):
   Create a `.env` file or export your variables:
   ```bash
   echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
   ```

3. **Build & Start the Container**:
   ```bash
   docker compose up -d --build
   ```

4. **Verify Running Instance**:
   ```bash
   docker compose ps
   curl http://localhost:3000/api/health
   ```

Nexus is now running on port `3000` with automated health checks, minimal memory footprint (~40MB RAM), and full Vanilla DOM execution!

---

## 🛠 Manual Docker Commands

If you prefer building without `docker-compose`:

```bash
# Build Docker image
docker build -t vanilla-nexus:v2.2 .

# Run container
docker run -d \
  --name nexus-app \
  --restart unless-stopped \
  -p 3000:3000 \
  -e GEMINI_API_KEY="your_api_key" \
  vanilla-nexus:v2.2
```

---

## 🌿 Lightweight Architecture Highlights

- **Pure Vanilla DOM UI Engine**: Zero React / virtual DOM reconciliation overhead at runtime.
- **Node.js Alpine Runtime**: Minimal footprint image (~120MB uncompressed).
- **Embedded Health Engine**: `/api/health` and `/api/info` endpoints for reverse proxy integration (Nginx / Caddy / Traefik).
- **Firebase / Firestore Native Persistence**: Real-time cloud sync with client-side fallback.
