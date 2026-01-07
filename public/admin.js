let socket;
let currentQuestion = 1;

const joinDiv = document.getElementById("join");
const dashboard = document.getElementById("dashboard");

const sessionInput = document.getElementById("sessionId");
const joinBtn = document.getElementById("joinBtn");

const sessionLabel = document.getElementById("sessionLabel");
const questionNo = document.getElementById("questionNo");
const buzzLog = document.getElementById("buzzLog");

const nextQuestionBtn = document.getElementById("nextQuestion");
const resetQuestionBtn = document.getElementById("resetQuestion");

/* UI expects: questionNumber -> array of buzzes */
const buzzesByQuestion = {};

joinBtn.onclick = () => {
  const sessionId = sessionInput.value.trim();
  if (!sessionId) return;

  const protocol = location.protocol === "https:" ? "wss" : "ws";

 socket = new WebSocket(
  `${protocol}://${location.host}/?role=scorer&session=${sessionId}`
);

  socket.onopen = () => {
    joinDiv.classList.add("hidden");
    dashboard.classList.remove("hidden");
    sessionLabel.innerText = sessionId;
  };

  socket.onmessage = event => {
    const msg = JSON.parse(event.data);

    /* -------- INITIAL STATE -------- */
    if (msg.type === "SESSION_STATE") {
      currentQuestion = msg.currentQuestion;
      questionNo.innerText = currentQuestion;

      // 🔴 FIX: normalize structure
      for (const q in msg.questions) {
        buzzesByQuestion[q] = [...msg.questions[q].buzzes];
      }

      renderRanking(currentQuestion);
    }

    /* -------- NEW BUZZ -------- */
    if (msg.type === "BUZZ_UPDATE") {
      addBuzz(msg.question, msg.buzz);
    }

    /* -------- NEXT QUESTION -------- */
    if (msg.type === "NEW_QUESTION") {
      currentQuestion = msg.question;
      questionNo.innerText = currentQuestion;
      buzzesByQuestion[currentQuestion] = [];
      buzzLog.innerHTML = "";
    }

    /* -------- RESET -------- */
    if (msg.type === "RESET") {
      buzzesByQuestion[currentQuestion] = [];
      buzzLog.innerHTML = "";
    }
  };
};

nextQuestionBtn.onclick = () => {
  socket.send(JSON.stringify({ type: "NEXT_QUESTION" }));
};

resetQuestionBtn.onclick = () => {
  socket.send(JSON.stringify({ type: "RESET_QUESTION" }));
};

/* ===================== RANKING LOGIC ===================== */

function addBuzz(question, buzz) {
  if (!buzzesByQuestion[question]) {
    buzzesByQuestion[question] = [];
  }

  buzzesByQuestion[question].push(buzz);
  renderRanking(question);
}

function renderRanking(question) {
  if (question !== currentQuestion) return;

  const buzzes = buzzesByQuestion[question];
  if (!buzzes || buzzes.length === 0) {
    buzzLog.innerHTML = "";
    return;
  }

  buzzLog.innerHTML = "";
  const firstTime = buzzes[0].time;

  buzzes.forEach((b, index) => {
    const div = document.createElement("div");
    div.classList.add("rank");

    if (index === 0) div.classList.add("first");
    else if (index === 1) div.classList.add("second");
    else if (index === 2) div.classList.add("third");

    const medal =
      index === 0 ? "🥇" :
      index === 1 ? "🥈" :
      index === 2 ? "🥉" :
      `${index + 1}.`;

    const time = new Date(b.time).toLocaleTimeString();
    const delta = b.time - firstTime;

    div.innerHTML = `
      <strong>${medal} ${b.team}</strong>
      <span>${time} (+${delta} ms)</span>
    `;

    buzzLog.appendChild(div);
  });
}
