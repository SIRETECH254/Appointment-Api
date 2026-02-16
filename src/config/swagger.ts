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
            : `http://localhost:${process.env.PORT || 4500}`,
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
      { name: "Auth", description: "Authentication and user session management" },
      { name: "Users", description: "User account and profile management" },
      { name: "Roles", description: "User role and permission management" },
      { name: "Services", description: "Service catalog management" },
      { name: "Availability", description: "Staff availability and slot calculation" },
      { name: "Appointments", description: "Appointment scheduling and management" },
      { name: "Breaks", description: "Staff break time management" },
      { name: "Payments", description: "Payment processing and history" },
      { name: "Notifications", description: "User notification management" },
      { name: "Store Configuration", description: "Global business rule configuration" },
      { name: "Contact", description: "Public contact form submissions" },
      { name: "Dashboard", description: "Analytics and statistical dashboards" }
    ]
  },
  apis: ["./src/routes/*.ts"]
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
