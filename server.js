console.log("🔥 SERVER FILE LOADED");

const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = 8080;

/* ===================== HTTP SERVER ===================== */

const server = http.createServer((req, res) => {
  let filePath;

  if (req.url === "/" || req.url === "/admin") {
    filePath = path.join(__dirname, "public", "admin.html");
  } else if (req.url === "/team") {
    filePath = path.join(__dirname, "public", "index.html");
  } else if (req.url === "/scorer") {
    filePath = path.join(__dirname, "public", "scorer.html");
  } else if (req.url === "/leaderboard") {
    filePath = path.join(__dirname, "public", "leaderboard.html");
  } else {
    filePath = path.join(__dirname, "public", req.url);
  }

  const ext = path.extname(filePath);
  const type =
    ext === ".html" ? "text/html" :
    ext === ".js" ? "text/javascript" :
    ext === ".css" ? "text/css" :
    "text/plain";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("404");
    } else {
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Running on http://0.0.0.0:${PORT}`);
});

/* ===================== WEBSOCKET ===================== */

const wss = new WebSocket.Server({ server });

const sessions = {};

wss.on("connection", (ws, req) => {
  const params = new URLSearchParams(req.url.replace("/?", ""));
  const role = params.get("role"); // admin | team | scorer | viewer
  const sessionId = params.get("session");
  const team = params.get("team");

  if (!role || !sessionId) {
    ws.close();
    return;
  }

  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      currentQuestion: 1,
      questions: {
        1: { buzzes: [], buzzedTeams: new Set() }
      },
      teams: {},   // score + history
      clients: new Set()
    };
  }

  const session = sessions[sessionId];
  session.clients.add(ws);

  ws.role = role;
  ws.team = team || null;

  if (role === "team" && team) {
    if (!session.teams[team]) {
      session.teams[team] = {
        score: 0,
        history: {} // question → marks
      };
    }
  }

  if (role === "admin") {
    ws.send(JSON.stringify({
      type: "SESSION_STATE",
      currentQuestion: session.currentQuestion,
      questions: serializeQuestions(session.questions)
    }));
  }

  if (role === "scorer" || role === "viewer") {
    sendLeaderboard(session, ws);
  }

  ws.on("message", raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const qNo = session.currentQuestion;
    const question = session.questions[qNo];

    /* TEAM BUZZ */
    if (msg.type === "BUZZ" && role === "team") {
      if (question.buzzedTeams.has(ws.team)) return;
      question.buzzedTeams.add(ws.team);

      const buzz = { team: ws.team, time: Date.now() };
      question.buzzes.push(buzz);

      broadcastAdmins(session, {
        type: "BUZZ_UPDATE",
        question: qNo,
        buzz
      });
    }

    /* ADMIN */
    if (msg.type === "NEXT_QUESTION" && role === "admin") {
      session.currentQuestion++;
      session.questions[session.currentQuestion] = {
        buzzes: [],
        buzzedTeams: new Set()
      };
      broadcast(session, {
        type: "NEW_QUESTION",
        question: session.currentQuestion
      });
    }

    if (msg.type === "RESET_QUESTION" && role === "admin") {
      question.buzzes = [];
      question.buzzedTeams.clear();
      broadcast(session, { type: "RESET" });
    }

    /* SCORER */
    if (msg.type === "UPDATE_SCORE" && role === "scorer") {
  const teamData = session.teams[msg.team];
  if (!teamData) return;

  const qNo = session.currentQuestion;

  // total score
  teamData.score += msg.delta;

  // per-question score
  if (!teamData.history[qNo]) {
    teamData.history[qNo] = 0;
  }
  teamData.history[qNo] += msg.delta;

  console.log(
    `📝 SCORE UPDATE → ${msg.team} | Q${qNo} | ${msg.delta}`
  );
  console.log("📚 HISTORY NOW:", teamData.history);

  broadcastLeaderboard(session);
}

  });

  ws.on("close", () => session.clients.delete(ws));
});

/* ===================== HELPERS ===================== */

function broadcast(session, data) {
  session.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify(data));
    }
  });
}

function broadcastAdmins(session, data) {
  session.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN && c.role === "admin") {
      c.send(JSON.stringify(data));
    }
  });
}

function broadcastLeaderboard(session) {
  const leaderboard = Object.entries(session.teams)
    .map(([team, obj]) => ({
      team,
      score: obj.score,
      history: obj.history || {}   // ✅ FORCE HISTORY
    }))
    .sort((a, b) => b.score - a.score);

  broadcast(session, {
    type: "LEADERBOARD_UPDATE",
    leaderboard
  });

  // 🔍 DEBUG LOG (IMPORTANT)
  console.log("📤 LEADERBOARD SENT:", JSON.stringify(leaderboard, null, 2));
}


function sendLeaderboard(session, ws) {
  ws.send(JSON.stringify({
    type: "LEADERBOARD_UPDATE",
    leaderboard: Object.entries(session.teams)
      .map(([team, obj]) => ({
        team,
        score: obj.score,
        history: obj.history
      }))
      .sort((a, b) => b.score - a.score)
  }));
}

function serializeQuestions(questions) {
  const out = {};
  for (const q in questions) {
    out[q] = { buzzes: questions[q].buzzes };
  }
  return out;
}
