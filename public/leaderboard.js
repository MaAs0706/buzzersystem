const sessionId = prompt("Session ID?");
const protocol = location.protocol === "https:" ? "wss" : "ws";



const socket = new WebSocket(
  `${protocol}://${location.host}/?role=scorer&session=${sessionId}`
);

const podium = document.getElementById("podium");
const others = document.getElementById("others");

socket.onmessage = e => {
  const msg = JSON.parse(e.data);
  if (msg.type === "LEADERBOARD_UPDATE") {
    render(msg.leaderboard);
  }
};

function render(list) {
  podium.innerHTML = "";
  others.innerHTML = "";

  // Step 1: build dense ranking groups
  let ranks = {};
  let rank = 0;
  let lastScore = null;

  list.forEach(t => {
    if (t.score !== lastScore) rank++;
    ranks[rank] = ranks[rank] || [];
    ranks[rank].push(t);
    lastScore = t.score;
  });

  // Step 2: render podium (ranks 1–3)
  [1, 2, 3].forEach(r => {
    if (!ranks[r]) return;

    const row = document.createElement("div");
    row.className = "podium-row";

    ranks[r].forEach(t => {
      const card = document.createElement("div");
      card.className = `podium-card ${
        r === 1 ? "first" :
        r === 2 ? "second" :
        "third"
      }`;

      const score = document.createElement("span");
      score.textContent = t.score;

      const name = document.createElement("h2");
      name.textContent = t.team;

      card.append(score, name);
      row.appendChild(card);
    });

    podium.appendChild(row);
  });

  // Step 3: render remaining teams
  Object.entries(ranks).forEach(([r, teams]) => {
    if (r <= 3) return;

    teams.forEach(t => {
      const row = document.createElement("div");
      row.className = "rank";
      row.textContent = `${r}. ${t.team} — ${t.score}`;
      others.appendChild(row);
    });
  });
}
