const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


function noop() {}
function heartbeat() {
  this.isAlive = true;
}

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000); 


const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use("/uploads", express.static(uploadsDir));


const BASE_URL = process.env.BASE_URL || "link da render ou retif por exemplo";

const usersFile = path.join(__dirname, "users.json");
const messagesFile = path.join(__dirname, "messages.json");

let usuarios = {};
let mensagens = [];

if (fs.existsSync(usersFile)) {
  usuarios = JSON.parse(fs.readFileSync(usersFile, "utf8"));
}
if (fs.existsSync(messagesFile)) {
  mensagens = JSON.parse(fs.readFileSync(messagesFile, "utf8"));
}

function salvarUsuarios() {
  fs.writeFileSync(usersFile, JSON.stringify(usuarios, null, 2));
}

function salvarMensagens() {
  fs.writeFileSync(messagesFile, JSON.stringify(mensagens, null, 2));
}

let conectados = new Map(); 

function atualizarLista() {
  const lista = Array.from(conectados.values());
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "user_list", users: lista }));
    }
  });
}


wss.on("connection", (ws) => {
  console.log("Novo cliente conectado!");

  ws.isAlive = true;
  ws.on("pong", heartbeat);

  ws.send(JSON.stringify({ type: "login_required" }));

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

  
    if (msg.type === "login") {
      let { username, password, avatar, avatarFile } = msg;

      if (!username || username.length > 28) {
        return ws.send(JSON.stringify({ type: "error", text: "Nome inválido (máx 28 caracteres)" }));
      }

      if (avatarFile && avatarFile.data && avatarFile.name) {
        const avatarPath = path.join(uploadsDir, "avatar_" + username + path.extname(avatarFile.name));
        fs.writeFileSync(avatarPath, Buffer.from(avatarFile.data, "base64"));
        avatar = `${BASE_URL}/uploads/${path.basename(avatarPath)}`;
      }

      if (usuarios[username]) {
        if (usuarios[username].password !== password) {
          return ws.send(JSON.stringify({ type: "error", text: "Senha incorreta para este usuário!" }));
        }
      } else {
        usuarios[username] = {
          password,
          avatar: avatar || "./img/redetekiIcon2.png"
        };
        salvarUsuarios();
      }

      conectados.set(ws, { username, avatar: usuarios[username].avatar });
      ws.send(JSON.stringify({ type: "login_success", username }));

      
      mensagens.slice(-50).forEach((m) => ws.send(JSON.stringify(m)));
      atualizarLista();
      return;
    }

    if (!conectados.has(ws)) {
      return ws.send(JSON.stringify({ type: "error", text: "Você precisa fazer login primeiro!" }));
    }

  
    if (msg.type === "message") {
      const { username, avatar } = conectados.get(ws);
      if (!msg.text || msg.text.length > 70) return;

      // proteção contra HTML malicioso (hackers safadinhos)
      const textoSeguro = msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      let texto = textoSeguro.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');

      const mensagem = { type: "message", text: `${username}: ${texto}`, avatar };
      mensagens.push(mensagem);
      salvarMensagens();

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(mensagem));
        }
      });
    }

  
    if (msg.type === "file") {
      const { username, avatar } = conectados.get(ws);
      if (!msg.name || !msg.data) return;

      const filePath = path.join(uploadsDir, msg.name);
      fs.writeFileSync(filePath, Buffer.from(msg.data, "base64"));

      const fileUrl = `${BASE_URL}/uploads/${msg.name}`;
      let conteudo;

      if (/\.(png|jpe?g|gif)$/i.test(msg.name)) {
        conteudo = `<img src="${fileUrl}" alt="${msg.name}" style="max-width:200px; max-height:200px; border-radius:8px;">`;
      } else {
        conteudo = `<a href="${fileUrl}" target="_blank">${msg.name}</a>`;
      }

      const mensagem = {
        type: "message",
        text: `${username}: ${conteudo}`,
        avatar
      };
      mensagens.push(mensagem);
      salvarMensagens();

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(mensagem));
        }
      });
    }
  });

  ws.on("close", () => {
    conectados.delete(ws);
    atualizarLista();
    console.log("Cliente desconectado");
  });
});

// -------------------- Servidor --------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
