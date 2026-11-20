const dotenv = require("dotenv");

dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env.prod" : ".env.dev",
});

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reportRoutes = require("./routes/reportRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const checkinRoutes = require("./routes/checkinRoutes");
const startReminderCron = require("./cron/reminderCron");
const startResignCron = require("./cron/resignCron");

const app = express();

app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Food Ordering API Running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/user", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/checkin", checkinRoutes);

app.use("/uploads", express.static("uploads"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Cho controller sử dụng
app.set("io", io);

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

async function startServer() {
  try {
    const configuredPort = process.env.PORT?.trim();
    const PORT = configuredPort ? Number(configuredPort) : 5001;

    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
      throw new Error(`Invalid PORT value: ${process.env.PORT}`);
    }

    // Do not accept API traffic or run database jobs before MongoDB is ready.
    await connectDB();

    startReminderCron();
    startResignCron();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running at http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("Server startup failed:", err);
    process.exit(1);
  }
}

startServer();
