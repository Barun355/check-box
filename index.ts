import express from "express"
import { createServer } from "http"
import { Server } from "socket.io"
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const app = express();
const server = createServer(app);
const io = new Server(server)

const __dirname = dirname(fileURLToPath(import.meta.url))
const MAX_ARRAY_COUNT = 10000;

let totalUsers = 0;

const checkboxs = new Array(MAX_ARRAY_COUNT).fill(false)

console.log({url: import.meta.url, __dirname, checkboxs})

app.use(express.static(join(__dirname + "/public")))

app.get("/", (req, res) => {
    res.sendFile(join(__dirname + "/index.html"))
})


io.on("connection", socket => {
    console.log("A user connected")
    
    totalUsers++;

    socket.on("disconnect", () => {
        console.log("A user disconnected")
        totalUsers--;
        broadcastStats()
    })

    socket.emit("checkbox:init", { checkboxs})
    broadcastStats()

    socket.on("checkbox:change", (data) => {
        console.log("Checkbox changed:", data)
        const { index, checked } = data;
        if (index > MAX_ARRAY_COUNT) {
            throw new Error("Index out of bound")
        }

        checkboxs[index] = checked;

        socket.broadcast.emit("checkbox:update", data)
    })
})

server.listen(3000, () => {
    console.log("Server is running on port 3000");
})


function broadcastStats() {
    io.emit("stats:update", { totalUsers })
}