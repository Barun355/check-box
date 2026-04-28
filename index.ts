import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { publisher, subscriber, redisAdapter } from "./redis-connection";
import { CHANNELS, SOCKET_EVENTS } from "./constant";

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAX_ARRAY_COUNT = 1000;
const PORT = process.env.PORT || 3000;

let totalUsers = 0;
let users = new Map();

const checkboxs = new Array(MAX_ARRAY_COUNT)
  .fill(false)
  .map(() => ({ state: false, userId: null, styles: {} }));

app.use(express.static(join(__dirname + "/public")));

app.get("/", (req, res) => {
  res.sendFile(join(__dirname + "/index.html"));
});

subscriber.subscribe(CHANNELS.CHECKBOX);
subscriber.on("message", (channel, message) => {
  if (channel === CHANNELS.CHECKBOX) {
    const parsedMessage = JSON.parse(message);
    io.emit(parsedMessage.event, parsedMessage.data);
  }
});

io.on("connection", async (socket) => {
  console.log("A user connected");

  const userId = socket.id;
  const colorAssigned = generateRandomHexColor();

  // users.set(userId, { colorAssigned })
  // totalUsers++;
  await redisAdapter.increaseUserCount(userId, colorAssigned);

  socket.on("disconnect", async () => {
    console.log("A user disconnected");

    clearUserFromCheckboxes(userId);

    // users.delete(userId);
    // totalUsers--;
    await redisAdapter.decreaseUserCount(userId);

    await broadcastStats();
  });

  socket.emit("checkbox:init", { checkboxs, userId, colorAssigned });
  await broadcastStats();

  socket.on("checkbox:change", (data) => {
    const { index, checked, userId } = data;
    const colorAssigned = getColorAssigned(userId);

    if (index > MAX_ARRAY_COUNT) {
      throw new Error("Index out of bound");
    }

    checkboxs[index]!.state = checked;
    checkboxs[index]!.userId = userId;
    checkboxs[index]!.styles = {
      backgroundColor: colorAssigned,
      borderColor: colorAssigned,
      boxShadow: `0 0 5px ${colorAssigned}`,
    };

    console.log({ checkboxs, index, checked, userId });

    io.emit("checkbox:update", { ...data, colorAssigned });
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

async function broadcastStats() {
  const result = await redisAdapter.getTotalUsers();

  console.log("stats:update", result.data.totalUsers);
  // io.emit("stats:update", { totalUsers: result.data.totalUsers })

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

function getColorAssigned(userId: string): string {
  return users.get(userId)?.colorAssigned || "#0099ff";
}

function clearUserFromCheckboxes(userId: string) {
  for (let i = 0; i < checkboxs.length; i++) {
    if (checkboxs[i]!.userId === userId) {
      checkboxs[i]!.userId = null;
    }
  }
}
