const secretInput = document.getElementById("secretInput");
const authGate = document.getElementById("authGate");
const loginForm = document.getElementById("loginForm");
const usernameInput1 = document.getElementById("usernameInput1");
const passwordInput1 = document.getElementById("passwordInput1");
const newPasswordInput1 = document.getElementById("newPasswordInput1");
const confirmPasswordInput1 = document.getElementById("confirmPasswordInput1");
const passwordUpdateFields1 = document.getElementById("passwordUpdateFields1");
const usernameInput2 = document.getElementById("usernameInput2");
const passwordInput2 = document.getElementById("passwordInput2");
const newPasswordInput2 = document.getElementById("newPasswordInput2");
const confirmPasswordInput2 = document.getElementById("confirmPasswordInput2");
const passwordUpdateFields2 = document.getElementById("passwordUpdateFields2");
const loginStatus = document.getElementById("loginStatus");
const scoreValue = document.getElementById("scoreValue");
const levelValue = document.getElementById("levelValue");
const setBtn = document.getElementById("setBtn");
const revealBtn = document.getElementById("revealBtn");
const resetBtn = document.getElementById("resetBtn");
const loginBtn = document.getElementById("loginBtn");
const musicBtn = document.getElementById("musicBtn");
const balloon = document.getElementById("balloon");
const display = document.getElementById("display");
const statusText = document.getElementById("status");

let secret = "";
let revealedCount = 0;
let audioContext;
let masterGain;
let musicIntervalId;
let noteIndex = 0;
let isMusicOn = false;
let score = 0;
let level = 1;
let mustChangePassword = { 1: false, 2: false };

const AUTH_STORAGE_KEY = "wordRevealerAuth";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
let inMemoryAuthStore = {};
const authInputs = {
  1: {
    username: usernameInput1,
    password: passwordInput1,
    updateFields: passwordUpdateFields1,
    newPassword: newPasswordInput1,
    confirmPassword: confirmPasswordInput1
  },
  2: {
    username: usernameInput2,
    password: passwordInput2,
    updateFields: passwordUpdateFields2,
    newPassword: newPasswordInput2,
    confirmPassword: confirmPasswordInput2
  }
};

const melody = [
  261.63, 329.63, 392.0, 329.63,
  293.66, 349.23, 440.0, 349.23,
  329.63, 392.0, 523.25, 392.0
];

function ensureAudioEngine() {
  if (audioContext) {
    return true;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    statusText.textContent = "Audio is not supported in this browser.";
    return false;
  }

  audioContext = new AudioCtx();
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.04;
  masterGain.connect(audioContext.destination);
  return true;
}

function playNote(frequency, startTime, duration) {
  const osc = audioContext.createOscillator();
  const noteGain = audioContext.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, startTime);

  noteGain.gain.setValueAtTime(0.0001, startTime);
  noteGain.gain.exponentialRampToValueAtTime(0.07, startTime + 0.03);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(noteGain);
  noteGain.connect(masterGain);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function startMusic() {
  if (!ensureAudioEngine()) {
    return;
  }

  if (musicIntervalId) {
    return;
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  isMusicOn = true;
  musicBtn.textContent = "Music Off";

  const stepMs = 320;
  musicIntervalId = window.setInterval(() => {
    const now = audioContext.currentTime;
    const freq = melody[noteIndex % melody.length];
    playNote(freq, now + 0.01, 0.22);
    noteIndex += 1;
  }, stepMs);
}

function stopMusic() {
  if (musicIntervalId) {
    window.clearInterval(musicIntervalId);
    musicIntervalId = undefined;
  }

  isMusicOn = false;
  if (musicBtn) {
    musicBtn.textContent = "Music On";
  }
}

function currentMaskedText() {
  let seen = 0;
  return secret
    .split("")
    .map((char) => {
      if (char === " ") {
        return "  ";
      }

      seen += 1;
      return seen <= revealedCount ? `${char} ` : "_ ";
    })
    .join("")
    .trimEnd();
}

function setLockedState(locked) {
  document.body.classList.toggle("locked", locked);

  if (locked) {
    authGate.removeAttribute("aria-hidden");
    usernameInput1.focus();
  } else {
    authGate.setAttribute("aria-hidden", "true");
    secretInput.focus();
  }
}

function loadAuthStore() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return inMemoryAuthStore;
  }
}

function saveAuthStore(store) {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(store));
  } catch {
    inMemoryAuthStore = store;
  }
}

function setPasswordChangeMode(slot, active) {
  const fields = authInputs[slot];
  mustChangePassword[slot] = active;
  fields.updateFields.hidden = !active;

  if (!active) {
    fields.newPassword.value = "";
    fields.confirmPassword.value = "";
  }

  const hasAnyUpdateFlow = mustChangePassword[1] || mustChangePassword[2];
  loginBtn.textContent = hasAnyUpdateFlow ? "Update Passwords" : "Login Both";
}

function isPasswordExpired(lastChangedAt) {
  if (!lastChangedAt) {
    return true;
  }

  return Date.now() - Number(lastChangedAt) >= ONE_YEAR_MS;
}

function updateHud() {
  scoreValue.textContent = String(score);
  levelValue.textContent = String(level);
}

function addScore(points) {
  score = Math.max(0, score + points);
  level = Math.floor(score / 120) + 1;
  updateHud();
}

function updateDisplay() {
  display.textContent = secret ? currentMaskedText() : "_ _ _ _ _";
}

function resetState() {
  revealedCount = 0;
  revealBtn.disabled = true;
  resetBtn.disabled = true;
  statusText.textContent = "Enter a phrase to begin.";
  updateDisplay();
}

setBtn.addEventListener("click", () => {
  const value = secretInput.value.trim();
  if (!value) {
    statusText.textContent = "Type a secret word or phrase first.";
    resetState();
    return;
  }

  secret = value;
  revealedCount = 0;
  revealBtn.disabled = false;
  resetBtn.disabled = false;
  statusText.textContent = "Secret set. Click Reveal Next.";
  updateDisplay();
});

revealBtn.addEventListener("click", () => {
  if (!secret) {
    statusText.textContent = "Set a secret first.";
    return;
  }

  const totalLetters = secret.replace(/\s/g, "").length;
  const previousCount = revealedCount;
  revealedCount = Math.min(revealedCount + 1, totalLetters);
  if (revealedCount > previousCount) {
    addScore(10);
  }
  updateDisplay();

  if (revealedCount >= totalLetters) {
    statusText.textContent = "Fully revealed.";
    revealBtn.disabled = true;
  } else {
    statusText.textContent = `Revealed ${revealedCount} of ${totalLetters}.`;
  }
});

resetBtn.addEventListener("click", () => {
  secret = "";
  secretInput.value = "";
  resetState();
});

musicBtn.addEventListener("click", () => {
  if (isMusicOn) {
    stopMusic();
    return;
  }

  startMusic();
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  for (const slot of [1, 2]) {
    const fields = authInputs[slot];
    if (!fields.username.value.trim() || !fields.password.value.trim()) {
      loginStatus.textContent = `Login ${slot}: username and password are required.`;
      return;
    }
  }

  const authStore = loadAuthStore();

  for (const slot of [1, 2]) {
    const fields = authInputs[slot];
    const username = fields.username.value.trim();
    const password = fields.password.value.trim();
    const existingUser = authStore[username];

    if (!existingUser) {
      authStore[username] = {
        password,
        passwordLastChangedAt: Date.now()
      };
      setPasswordChangeMode(slot, false);
      continue;
    }

    if (existingUser.password !== password) {
      loginStatus.textContent = `Login ${slot}: invalid username or password.`;
      return;
    }

    if (!mustChangePassword[slot] && isPasswordExpired(existingUser.passwordLastChangedAt)) {
      setPasswordChangeMode(slot, true);
      loginStatus.textContent = `Login ${slot}: password expired. Please set a new password.`;
      fields.newPassword.focus();
      return;
    }

    if (mustChangePassword[slot]) {
      const newPassword = fields.newPassword.value.trim();
      const confirmPassword = fields.confirmPassword.value.trim();

      if (!newPassword || !confirmPassword) {
        loginStatus.textContent = `Login ${slot}: enter and confirm your new password.`;
        return;
      }

      if (newPassword.length < 4) {
        loginStatus.textContent = `Login ${slot}: new password must be at least 4 characters.`;
        return;
      }

      if (newPassword !== confirmPassword) {
        loginStatus.textContent = `Login ${slot}: new password and confirmation do not match.`;
        return;
      }

      if (newPassword === password) {
        loginStatus.textContent = `Login ${slot}: new password must be different from the current password.`;
        return;
      }

      authStore[username] = {
        password: newPassword,
        passwordLastChangedAt: Date.now()
      };
      fields.password.value = newPassword;
      setPasswordChangeMode(slot, false);
    }
  }

  saveAuthStore(authStore);
  loginStatus.textContent = "";
  setLockedState(false);
  statusText.textContent = `Welcome, ${usernameInput1.value.trim()} and ${usernameInput2.value.trim()}. Enter a phrase to begin.`;
});

balloon.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  revealAllLetters();
});

function revealAllLetters() {
  if (!secret) {
    statusText.textContent = "Set a secret first.";
    return;
  }

  const totalLetters = secret.replace(/\s/g, "").length;
  const remainingLetters = Math.max(0, totalLetters - revealedCount);
  revealedCount = totalLetters;
  if (remainingLetters > 0) {
    addScore(remainingLetters * 4);
  }
  updateDisplay();
  revealBtn.disabled = true;
  statusText.textContent = "Balloon popped. Full word revealed.";
}

balloon.addEventListener("click", () => {
  revealAllLetters();
});

updateDisplay();
updateHud();
setPasswordChangeMode(1, false);
setPasswordChangeMode(2, false);
setLockedState(true);