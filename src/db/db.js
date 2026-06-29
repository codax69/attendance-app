import mongoose from "mongoose";
import dns from "node:dns";
import { Class } from "../models/class.model.js";
import { runDatabaseMigration } from "./migration.js";

// By default do not mutate global DNS settings. Export an initializer
// or set FORCE_GOOGLE_DNS=true to opt in on environments that need it.
export const initGlobalDNSOverride = () => {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
  dns.setDefaultResultOrder("ipv4first");
};

export const ConnectDB = async () => {
  if (process.env.FORCE_GOOGLE_DNS === "true") {
    initGlobalDNSOverride();
  }
  try {
    // Validate required environment variable
    if (!process.env.DB_URI) {
      throw new Error("DB_URI environment variable is not defined. Please check your .env file.");
    }

    const connectionDB = await mongoose.connect(
      process.env.DB_URI,
      { 
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      },
    );
    console.log("✅ DB HOSTED ON:", connectionDB.connection.host);

    // Run SaaS migration
    await runDatabaseMigration();

  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
};