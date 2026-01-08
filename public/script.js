let socket;
let locked = false;

const ADMIN_CODE = "jayam@123"; // 🔒 change this


const joinDiv = document.getElementById("join");
const buzzerScreen = document.getElementById("buzzerScreen");

const sessionInput = document.getElementById("sessionId");
const teamInput = document.getElementById("teamName");
const joinBtn = document.getElementById("joinBtn");

const buzzer = document.getElementById("buzzer");
const status = document.getElementById("status");
const teamLabel = document.getElementById("teamLabel");

const adminBtn = document.getElementById("adminAccessBtn");

adminBtn.onclick = () => {
  const code = prompt("Enter Admin Code:");
  if (!code) return;

  if (code === ADMIN_CODE) {
    window.location.href = "/admin";
  } else {
    alert("❌ Invalid admin code");
  }
};


joinBtn.onclick = () => {
  const sessionId = sessionInput.value.trim();
  const teamName = teamInput.value.trim();
  if (!sessionId || !teamName) return;

  const protocol = location.protocol === "https:" ? "wss" : "ws";

 socket = new WebSocket(
  `${protocol}://${location.host}/?role=scorer&session=${sessionId}`
);

  socket.onopen = () => {
    joinDiv.classList.add("hidden");
    buzzerScreen.classList.remove("hidden");
    teamLabel.innerText = `Team: ${teamName}`;
    status.innerText = "Waiting...";
  };

  socket.onmessage = event => {
    const msg = JSON.parse(event.data);

    // 🔓 ONLY unlock on reset or new question
    if (msg.type === "RESET" || msg.type === "NEW_QUESTION") {
      locked = false;
      buzzer.classList.remove("locked");
      status.innerText = "Waiting...";
    }
  };
};

buzzer.onclick = () => {
  if (locked) return;

  socket.send(JSON.stringify({ type: "BUZZ" }));
  locked = true;                       // 🔒 lock ONLY this team
  buzzer.classList.add("locked");
  status.innerText = "Buzzed!";
};
