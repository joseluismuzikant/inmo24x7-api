// src/index.ts
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "node:path";

import { messageRouter } from "./routes/message.js";
import { leadsRouter } from "./routes/leads.js";
import { adminRouter } from "./routes/admin.js";
import { authMiddleware } from "./middleware/auth.js";

const app = express();

/**
 * CORS
 * - Must be registered BEFORE auth middleware
 * - Must allow preflight (OPTIONS) without auth
 */
const allowedOrigins = [
  "http://localhost",
  "http://localhost:80",
  "http://localhost:5173",
  "http://127.0.0.1",
  "http://127.0.0.1:80",
  "http://127.0.0.1:5173",
  "https://backoffice.inmo24x7.com",
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests without Origin (curl, server-to-server)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Always respond to preflight
app.options("*", cors());

// Parsers / static
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(process.cwd(), "src", "public")));

// Unprotected health endpoint
app.get("/health", (_req, res) => res.json({ ok: true, service: "inmo24x7-api" }));

// Protect everything below (routes). Preflight is already handled.
app.use(authMiddleware);

// Protected routes
app.use(messageRouter);
app.use(leadsRouter);
app.use(adminRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`✅ Inmo24x7 API running on http://localhost:${port}`);
});
