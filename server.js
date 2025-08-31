// server.js
import express from "express";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import flash from "connect-flash";
import methodOverride from "method-override";
import { fileURLToPath } from "url";
import expressLayouts from "express-ejs-layouts";
import adminRoutes from "./src/routes/adminRoutes.js";
import db from "./src/config/db.js";
import { initializeRAGDatabase } from "./src/utils/ragUtils.js";

// Load env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- View Engine ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src", "views"));
app.use(expressLayouts);
app.set("layout", "layout"); // uses src/views/layout.ejs

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

// --- Sessions & Flash ---
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev_secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(flash());

// --- Global variables for all views ---
app.use((req, res, next) => {
  res.locals.title = "Admin RAG"; // default title
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.info = req.flash("info");
  res.locals.admin = req.session?.admin || null;
  next();
});

// --- Static Files ---
app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/uploads",
  express.static(path.join(__dirname, process.env.UPLOAD_DIR || "uploads"))
);

// --- Routes ---
app.use("/admin", adminRoutes);

// --- Home Route ---
app.get("/", (req, res) => {
  res.render("home", { title: "Welcome to Admin RAG" });
});

// --- DB check + RAG Initialization + Server Start ---
db.getConnection()
  .then(async (conn) => {
    conn.release();
    console.log("✅ Database connected successfully");
    
    // Initialize RAG database tables (with error handling)
    try {
      await initializeRAGDatabase();
      console.log("✅ RAG database initialized");
    } catch (error) {
      console.error("❌ RAG initialization failed:", error.message);
      console.log("⚠️  Server will continue without RAG features");
    }
    
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📁 Upload directory: ${process.env.UPLOAD_DIR || 'uploads'}`);
      console.log(`🗄️  Database connection: Active`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  });