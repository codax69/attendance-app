import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { ApiError } from "./utils/ApiErrorHandler.js";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(cookieParser({}));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cors({
  origin: "*", 
  methods: ['GET', 'POST','PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));


app.use(express.static("public"));

import userRouter from "./routes/user.routes.js";
import attendanceRouter from "./routes/attendance.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import adminRouter from "./routes/admin.routes.js";
app.use(["/api/v1/user", "/api/api/v1/user"], userRouter);
app.use(["/api/v1/", "/api/api/v1/"], attendanceRouter);
app.use(["/api/v1/", "/api/api/v1/"], notificationRouter);
app.use(["/api/v1/", "/api/api/v1/"], adminRouter);

// Catch 404 and forward to global error handler
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  let statusCode = err.statuscode || err.statusCode || 500;
  let message = err.message || "Something went wrong";
  let errors = err.errors || [];

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `Duplicate value error: ${field} is already in use.`;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors).map((val) => val.message).join(", ");
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors
  });
});

export { app };
