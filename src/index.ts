
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import "dotenv/config";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import swaggerConfig from "./config/swagger";
import authRoutes from "./routes/authRoutes";
import roleRoutes from "./routes/roleRoutes";
import userRoutes from "./routes/userRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import storeConfigurationRoutes from "./routes/storeConfigurationRoutes";

const app = express();
const PORT = process.env.PORT || 4500;

// CORS Configuration with explicit origins
const allowedOrigins = [
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
  "http://localhost:8084",
  "http://localhost:8085",
  "http://localhost:4500"
];

// CORS middleware configuration
app.use(
  cors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Allow requests with no origin (like mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS blocked request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.options("*", cors());

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// DB CONNECTION
mongoose
.connect(process.env.MONGO_URI as string)
.then(() => console.log("DB CONNECTED"))
.catch((err) => console.log("DB Connection Error:", err.message));

// Static file serving for uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "Appointment API Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0"
  });
});

// CORS debug endpoint (helpful for troubleshooting)
app.get("/api/debug/cors", (req, res) => {
  res.json({
    allowedOrigins,
    requestOrigin: req.get("origin") || "No origin header",
    corsEnabled: true,
    environmentVariable: process.env.CORS_ORIGIN ? "Set" : "Not Set",
    timestamp: new Date().toISOString()
  });
});

// Swagger Documentation
app.use(
  "/api/docs",
  swaggerConfig.swaggerUi.serve,
  swaggerConfig.swaggerUi.setup(swaggerConfig.specs, swaggerConfig.options)
);

// Auth, Role, User routes
app.use("/api/auth", authRoutes);

app.use("/api/roles", roleRoutes);

app.use("/api/users", userRoutes);

app.use("/api/notifications", notificationRoutes);

app.use("/api/store-configuration", storeConfigurationRoutes);


// Socket.io setup for real-time features
// Create HTTP server that wraps the Express app
const server = createServer(app);

// Attach Socket.io to the HTTP server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Store socket connections for real-time notifications
const socketConnections = new Map<string, string>();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Listen for user authentication to map socket to user
  socket.on("authenticate", (userId: string) => {
    socketConnections.set(userId, socket.id);
    socket.join(`user_${userId}`);
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    // Remove from connections
    for (const [key, value] of socketConnections.entries()) {
      if (value === socket.id) {
        socketConnections.delete(key);
        break;
      }
    }
    console.log("Client disconnected:", socket.id);
  });
});

app.set("io", io);
app.set("socketConnections", socketConnections);

// Main API endpoint
app.get("/api", (_req, res) => {
  res.json({
    message: "Welcome to Appointment API",
    version: "1.0.0",
    documentation: "/api/docs",
    endpoints: {
      health: "/api/health"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

// Global error handler
app.use(
  (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
      success: false,
      message,
      ...(process.env.NODE_ENV === "development" && {
        error: err.message,
        stack: err.stack
      })
    });
  }
);

// Start server
// We listen on the HTTP server (which includes the Express app)
// This allows both HTTP routes AND Socket.io connections to work
server.listen(PORT, (err?: Error) => {
  if (!err) {
    console.log(`🚀 Appointment API Server running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔒 CORS Origins: ${allowedOrigins.join(", ")}`);
    console.log("🔌 Socket.io enabled for real-time features");
  } else {
    console.error("Failed to start server:", err);
  }
});
