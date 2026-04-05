// src/index.ts
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";

import { messageRouter } from "./routes/message.js";
import { leadsRouter } from "./routes/leads.js";
import { propertiesRouter } from "./routes/properties.js";
import { adminRouter } from "./routes/admin.js";
import { profileRouter } from "./routes/profile.js";
import { whatsappRouter } from "./routes/whatsapp.js";
import { healthRouter } from "./routes/health.js";
import { authMiddleware } from "./middleware/auth.js";
import { swaggerSpec } from "./config/swagger.js";

const app = express();
const appVersion = process.env.APP_VERSION ?? "dev";
const appCommitSha = process.env.APP_COMMIT_SHA ?? "local";

/**
 * CORS
 * - Must be registered BEFORE auth middleware
 * - Must allow preflight (OPTIONS) without auth
 */
const allowedOrigins = [
  "http://localhost",
  "http://localhost:80",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1",
  "http://127.0.0.1:80",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
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
    allowedHeaders: ["Content-Type", "Authorization", "X-Source-Type"],
  })
);

// Always respond to preflight
app.options("*", cors());

// Parsers / static
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  })
);

// health endpoints (unprotected) 
app.use(healthRouter);

// Swagger documentation (unprotected)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

// WhatsApp webhook verification (unprotected)
app.use(whatsappRouter);

// Protect everything below (routes). Preflight is already handled.
app.use(authMiddleware);

// Protected routes
app.use(messageRouter);
app.use(leadsRouter);
app.use(propertiesRouter);
app.use(adminRouter);
app.use(profileRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`✅ Inmo24x7 API running on http://localhost:${port}`);
});
