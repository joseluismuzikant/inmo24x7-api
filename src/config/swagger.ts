import path from "path";
import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Inmo24x7 API",
      version: "0.1.0",
      description: "API documentation for Inmo24x7 real estate chatbot service",
    },
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