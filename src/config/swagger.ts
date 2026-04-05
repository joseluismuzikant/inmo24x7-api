import path from "path";
import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inmo24x7 API",
      version: "0.1.0",
      description: "Multi-tenant API for backoffice/admin operations, onboarding, leads, properties and channels",
    },
    tags: [
      { name: "Admin", description: "Admin-only tenant management endpoints" },
      { name: "Tenant Channels", description: "Tenant notification channels" },
      { name: "Leads", description: "Lead management endpoints" },
      { name: "Properties", description: "Property listing endpoints" },
      { name: "Auth", description: "Authentication/profile endpoints" },
    ],
    servers: [
      {
        url: process.env.PUBLIC_API_URL || "http://localhost:3000",
        description: "API server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
      },
    },
  },
  apis: [
    path.resolve(process.cwd(), "src/routes/**/*.ts"),
    path.resolve(process.cwd(), "src/index.ts"),
    path.resolve(process.cwd(), "dist/routes/**/*.js"),
    path.resolve(process.cwd(), "dist/index.js"),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
