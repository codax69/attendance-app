import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(cookieParser({}));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    "https://ictsm-attendance.vercel.app"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(
  cors({
    origin:
      `${process.env.CORS_ORIGIN}` || "https://ictsm-attendance.vercel.app/",
    credentials: true,
  })
);
app.use(express.static("public"));

import userRouter from "./routes/user.routes.js";
import attendanceRouter from "./routes/attendance.routes.js";
app.use("/api/v1/user", userRouter);
app.use("/api/v1/", attendanceRouter);

export { app };
