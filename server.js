console.log("🔥 SERVER FILE LOADED");

const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = 8080;

/* ===================== HTTP SERVER ===================== */

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, "public", req.url);

  if (req.url === "/") {
    filePath = path.join(__dirname, "public", "admin.html");
  }

  const ext = path.extname(filePath);
  const contentType =
    ext === ".html" ? "text/html" :
    ext === ".js" ? "text/javascript" :
    ext === ".css" ? "text/css" :
    "text/plain";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("404 Not Found");
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 HTTP + WS server running on http://0.0.0.0:${PORT}`);
});

/* ===================== WEBSOCKET SERVER ===================== */

const wss = new WebSocket.Server({ server });

/*
sessions = {
  sessionId: {
    currentQuestion: Number,
    questions: {
      [qNo]: {
        buzzes: [{ team, time }],
        buzzedTeams: Set
      }
    },
    clients: Set<WebSocket>
  }
}
*/
const sessions = {};

wss.on("connection", (ws, req) => {
  console.log("🔌 NEW WS CONNECTION:", req.url);

  const params = new URLSearchParams(req.url.replace("/?", ""));
  const role = params.get("role");     // admin | team
  const sessionId = params.get("session");
  const team = params.get("team");

  if (!role || !sessionId) {
    ws.close();
    return;
  }

  /* ---------- CREATE SESSION IF NEEDED ---------- */

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      currentQuestion: 1,
      questions: {
        1: {
          buzzes: [],
          buzzedTeams: new Set()
        }
      },
      clients: new Set()
    };
    console.log(`🆕 Session created: ${sessionId}`);
  }

  const session = sessions[sessionId];
  session.clients.add(ws);

  ws.role = role;
  ws.team = team || null;

  console.log(
    `✅ CONNECTED → role=${role}, session=${sessionId}, team=${team || "-"}`
  );

  /* ---------- SEND INITIAL STATE TO ADMIN ---------- */

  if (role === "admin") {
    ws.send(JSON.stringify({
      type: "SESSION_STATE",
      currentQuestion: session.currentQuestion,
      questions: serializeQuestions(session.questions)
    }));
  }

  /* ===================== MESSAGE HANDLER ===================== */

  ws.on("message", raw => {
    console.log("📩 RAW MESSAGE:", raw.toString());

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const qNo = session.currentQuestion;
    const question = session.questions[qNo];

    /* ---------- TEAM BUZZ ---------- */
    if (msg.type === "BUZZ" && role === "team") {
      console.log("🚨 BUZZ FROM:", ws.team);

      if (question.buzzedTeams.has(ws.team)) {
        console.log("⛔ IGNORED (already buzzed):", ws.team);
        return;
      }

      question.buzzedTeams.add(ws.team);

      const buzz = {
        team: ws.team,
        time: Date.now()
      };

      question.buzzes.push(buzz);

      console.log("📊 CURRENT BUZZ LIST:", question.buzzes);

      broadcastAdmins(session, {
        type: "BUZZ_UPDATE",
        question: qNo,
        buzz
      });
    }

    /* ---------- ADMIN: NEXT QUESTION ---------- */
    if (msg.type === "NEXT_QUESTION" && role === "admin") {
      session.currentQuestion += 1;
      session.questions[session.currentQuestion] = {
        buzzes: [],
        buzzedTeams: new Set()
      };

      broadcast(session, {
        type: "NEW_QUESTION",
        question: session.currentQuestion
      });

      console.log(`➡️ NEXT QUESTION → Q${session.currentQuestion}`);
    }

    /* ---------- ADMIN: RESET QUESTION ---------- */
    if (msg.type === "RESET_QUESTION" && role === "admin") {
      question.buzzes = [];
      question.buzzedTeams.clear();

      broadcast(session, { type: "RESET" });

      console.log(`🔄 RESET QUESTION → Q${qNo}`);
    }
  });

  ws.on("close", () => {
    session.clients.delete(ws);
    console.log("❌ DISCONNECTED:", ws.team || ws.role);
  });
});

/* ===================== HELPERS ===================== */

function broadcast(session, data) {
  session.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function broadcastAdmins(session, data) {
  session.clients.forEach(client => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.role === "admin"
    ) {
      client.send(JSON.stringify(data));
    }
  });
}

/* Convert Sets so admin can read state */
function serializeQuestions(questions) {
  const out = {};
  for (const q in questions) {
    out[q] = {
      buzzes: questions[q].buzzes
    };
  }
  return out;
}
