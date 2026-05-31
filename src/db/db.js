import mongoose from "mongoose";
import dns from "node:dns";
import { Class } from "../models/class.model.js";

// By default do not mutate global DNS settings. Export an initializer
// or set FORCE_GOOGLE_DNS=true to opt in on environments that need it.
export const initGlobalDNSOverride = () => {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
  dns.setDefaultResultOrder("ipv4first");
};

if (process.env.FORCE_GOOGLE_DNS === "true") {
  initGlobalDNSOverride();
}

export const ConnectDB = async () => {
  try {
    const connectionDB = await mongoose.connect(
      process.env.DB_URI,
      { family: 4, dbName: "attendance-app" },
    );
    console.log("DB HOSTED ON:", connectionDB.connection.host);

    // Seed default classes if none exist
    try {
      const defaultClasses = [
        { name: "Information Technology", code: "IT" },
        { name: "Computer Engineering", code: "CO" },
        { name: "Mechanical Engineering", code: "ME" },
        { name: "Electrical Engineering", code: "EE" },
        { name: "Civil Engineering", code: "CE" },
        { name: "Electronics & Communication", code: "EC" },
      ];
      const count = await Class.countDocuments();
      if (count === 0) {
        await Class.insertMany(defaultClasses);
        console.log("✅ Seeded default classes successfully");
      }
    } catch (seedErr) {
      console.warn("⚠️ Class seeding failed:", seedErr.message);
    }

    // Remove stale MongoDB $jsonSchema validators from collections
    // that conflict with current Mongoose schema definitions
    try {
      const db = connectionDB.connection.db;
      await db.command({
        collMod: "orders",
        validator: {},
        validationLevel: "off",
      });
      console.log("✅ Removed stale validator from 'orders' collection");
    } catch (validatorErr) {
      // Collection may not exist yet or no validator to remove — safe to ignore
      if (validatorErr.codeName !== "NamespaceNotFound") {
        console.warn(
          "⚠️ Could not remove orders validator:",
          validatorErr.message,
        );
      }
    }
  } catch (error) {
    if (error.name === "MongooseServerSelectionError") {
      console.error(
        "\n❌ MongoDB Connection Error: Could not connect to any servers.",
      );
      console.error(
        "👉 This is usually caused by your IP address not being whitelisted in MongoDB Atlas.",
      );
      console.error("🔗 Whitelist your IP here: https://cloud.mongodb.com/\n");
    } else {
      console.error("DataBase Connection ERROR:", error);
    }
    process.exit(1);
  }
};