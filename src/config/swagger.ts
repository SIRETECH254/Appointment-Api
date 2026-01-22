import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Appointment API",
      version: "1.0.0",
      description:
        "Appointment API server for managing appointments and related resources",
      contact: {
        name: "Appointment API Support",
        email: "support@example.com"
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT"
      }
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? process.env.API_BASE_URL || "https://example.com"
            : `http://localhost:${process.env.PORT || 4000}`,
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Bearer token in the format: Bearer <token>"
        }
      }
    },
    tags: [
      {
        name: "Appointments",
        description: "Appointment management"
      },
      {
        name: "Users",
        description: "User management"
      }
    ]
  },
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/models/*.ts"]
};

const specs = swaggerJsdoc(options);

const swaggerConfig = {
  swaggerUi,
  specs,
  options: {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2563eb }
      .swagger-ui .scheme-container { background: #f8f9fa }
      .swagger-ui .info .description { font-size: 16px; color: #6b7280; }
    `,
    customSiteTitle: "Appointment API Documentation",
    customfavIcon: "/favicon.ico"
  }
};

export default swaggerConfig;
