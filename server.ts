import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // API Health Check & Nexus Sovereign Status
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      nexus: "Vanilla Nexus Core",
      mode: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      sovereign: true
    });
  });

  app.get("/api/info", (req, res) => {
    res.json({
      name: "Vanilla Nexus Core",
      version: "2.2.0-Sovereign",
      architecture: "Pure Vanilla DOM & Firebase Sovereign Engine",
      containerized: true,
      lightweight: true
    });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nexus Sovereign Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
