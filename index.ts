import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join, parse } from "path";
import { publisher, subscriber, redisAdapter, redis } from "./redis-connection";
import { CHANNELS, MAX_ARRAY_COUNT, SOCKET_EVENTS } from "./constant";

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

app.use(express.static(join(__dirname + "/public")));

app.get("/", (_, res) => {
  res.sendFile(join(__dirname + "/index.html"));
});

subscriber.subscribe(CHANNELS.CHECKBOX);
subscriber.on("message", async (channel, message) => {
  if (channel === CHANNELS.CHECKBOX) {
    const parsedMessage = JSON.parse(message);

    console.log('Valkey:message:subscriber-1', parsedMessage)

    if (parsedMessage.event === SOCKET_EVENTS.STATS_UPDATE) {
      io.emit(parsedMessage.event, parsedMessage.data);
    } else if (parsedMessage.event === SOCKET_EVENTS.CHECKBOX_CHANGE) {
      const { data } = parsedMessage;

      const { index, checked, userId } = data;
      const result = await redisAdapter.getUserById(userId);

      console.log("Valkey:GetUserById", result);
      const { colorAssigned } = result.data;

      if (index > MAX_ARRAY_COUNT) {
        throw new Error("Index out of bound");
      }

      const updatedCheckbox = await redisAdapter.updateCheckbox(index, {
        state: checked,
        userId,
        styles: {
          backgroundColor: colorAssigned,
          borderColor: colorAssigned,
          boxShadow: `0 0 5px ${colorAssigned}`,
        },
      });
      console.log({ updatedCheckbox });

      io.emit("checkbox:update", { ...data, colorAssigned });
    }
  }
});

io.on("connection", async (socket) => {
  console.log("A user connected");

  const userId = socket.id;
  const colorAssigned = generateRandomHexColor();
  const { data: initialCheckboxes } = await redisAdapter.getCheckboxes();

  console.log("inital checkboxes")

  await redisAdapter.addUser(userId, colorAssigned);

  socket.on("disconnect", async () => {
    console.log("A user disconnected");

    await redisAdapter.clearUserFromCheckboxes(userId);

    await redisAdapter.decreaseUserCount(userId);

    await broadcastStats();
  });

  socket.emit("checkbox:init", { checkboxs: initialCheckboxes , userId, colorAssigned });
  await broadcastStats();

  socket.on("checkbox:change", (data) => {
    publisher.publish(
      CHANNELS.CHECKBOX,
      JSON.stringify({
        data,
        event: SOCKET_EVENTS.CHECKBOX_CHANGE,
      }),
    );
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

async function broadcastStats() {
  const result = await redisAdapter.getTotalUsers();

  console.log("stats:update", result.data.totalUsers);

  publisher.publish(
    CHANNELS.CHECKBOX,
    JSON.stringify({
      data: { totalUsers: result.data.totalUsers },
      event: SOCKET_EVENTS.STATS_UPDATE,
    }),
  );
}

function generateRandomHexColor(): string {
  // Generate colors with good saturation and lightness
  // Hue: 0-360, Saturation: 50-100%, Lightness: 40-65%
  const hue = Math.floor(Math.random() * 360);
  const saturation = Math.floor(Math.random() * 50 + 50); // 50-100%
  const lightness = Math.floor(Math.random() * 25 + 40); // 40-65%

  // Convert HSL to HEX
  const hslToHex = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - (((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    const toHex = (value: number) => {
      const hex = Math.round((value + m) * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  return hslToHex(hue, saturation, lightness);
}

async function gracefulShutdown(signal: "SIGINT" | "SIGTERM") {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    // Stop accepting new connections
    server.close(async () => {
        console.log('HTTP server closed.');

        try {
            // Close database connections
            await redisAdapter.redisClient.quit();
            console.log('Redis connection closed.');
            process.exit(0);
        } catch (err) {
            console.error('Error during shutdown:', err);
            process.exit(1);
        }
    });

    // Force exit after 10 seconds if it hangs
    setTimeout(() => {
        console.error('Could not close connections in time, forcing shut down');
        process.exit(1);
    }, 10000);
}

// 4. Listen for signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Docker stop
