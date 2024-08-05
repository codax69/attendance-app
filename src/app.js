import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(cookieParser({}));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cors({
  origin: 'https://ictsmattendance.netlify.app/', 
  methods: ['GET', 'POST','PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));


app.use(express.static("public"));

import userRouter from "./routes/user.routes.js";
import attendanceRouter from "./routes/attendance.routes.js";
app.use("/api/v1/user", userRouter);
app.use("/api/v1/", attendanceRouter);

export { app };
