const sessionId = prompt("Session ID?");
const socket = new WebSocket(
  `ws://${location.hostname}:8080/?role=viewer&session=${sessionId}`
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

  const top3 = list.slice(0, 3);
  const order = [1, 0, 2];

  order.forEach(pos => {
    const t = top3[pos];
    if (!t) return;

    const card = document.createElement("div");
    card.className = `podium-card ${["first","second","third"][pos]}`;

    const score = document.createElement("span");
    score.textContent = t.score;

    const name = document.createElement("h2");
    name.textContent = t.team;

    card.append(score, name);
    podium.appendChild(card);
  });

  list.slice(3).forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "rank";
    row.textContent = `${i + 4}. ${t.team} — ${t.score}`;
    others.appendChild(row);
  });
}
