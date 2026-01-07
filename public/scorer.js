const sessionId = prompt("Session ID?");
const protocol = location.protocol === "https:" ? "wss" : "ws";

const socket = new WebSocket(
  `${protocol}://${location.host}/?role=scorer&session=${sessionId}`
);

const teamsDiv = document.getElementById("teams");

/*
teams = {
  TeamA: {
    score: 30,
    history: { 1: 10, 2: 5, 3: 15 }
  }
}
*/
let teams = {};

/* ===================== SOCKET HANDLER ===================== */

socket.onmessage = e => {
  const msg = JSON.parse(e.data);

  if (msg.type === "LEADERBOARD_UPDATE") {
    msg.leaderboard.forEach(t => {
      if (!teams[t.team]) {
        teams[t.team] = { score: 0, history: {} };
      }

      teams[t.team].score = t.score;
      teams[t.team].history = t.history || {};
    });

    render();
  }
};

/* ===================== RENDER ===================== */

function render() {
  teamsDiv.innerHTML = "";

  Object.entries(teams).forEach(([team, data]) => {
    const box = document.createElement("div");
    box.className = "team";

    // Team name + total
    const title = document.createElement("strong");
    title.textContent = `${team} — ${data.score}`;

    // Per-question breakdown
    const history = document.createElement("div");
    history.className = "history";
    history.textContent = formatHistory(data.history);

    // Controls
    const controls = document.createElement("div");
    controls.className = "controls";

    controls.appendChild(button("+5", () => update(team, 5)));
    controls.appendChild(button("+10", () => update(team, 10)));
    controls.appendChild(button("-5", () => update(team, -5)));
    controls.appendChild(button("-10", () => update(team, -10)));

    const input = document.createElement("input");
    input.type = "number";
    input.placeholder = "±";

    const apply = button("Apply", () => {
      const val = parseInt(input.value);
      if (!isNaN(val)) {
        update(team, val);
        input.value = "";
      }
    });

    controls.appendChild(input);
    controls.appendChild(apply);

    box.appendChild(title);
    box.appendChild(history);
    box.appendChild(controls);

    teamsDiv.appendChild(box);
  });
}

/* ===================== HELPERS ===================== */

function formatHistory(history) {
  const entries = Object.entries(history);
  if (entries.length === 0) return "No scores yet";

  return entries
    .sort((a, b) => a[0] - b[0])
    .map(([q, v]) => `Q${q}: ${v > 0 ? "+" : ""}${v}`)
    .join(" | ");
}

function button(label, handler) {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.onclick = handler;
  return btn;
}

function update(team, delta) {
  socket.send(JSON.stringify({
    type: "UPDATE_SCORE",
    team,
    delta
  }));
}
const leaderboardBtn = document.getElementById("leaderboardBtn");

leaderboardBtn.onclick = () => {
  const url = `http://${location.hostname}:8080/leaderboard`;
  window.open(url, "_blank"); // open in new tab
};
