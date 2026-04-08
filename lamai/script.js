// SECTION: DOM References
const micButton = document.getElementById("mic-button");
const micLabel = document.getElementById("mic-label");
const stopSpeechBtn = document.getElementById("stop-speech");
const conversationEl = document.getElementById("conversation");
const connectionStatus = document.getElementById("connection-status");
const orbCore = document.getElementById("orb-core");
const shortcutChips = document.querySelectorAll(".chip");

// SECTION: Speech Synthesis (Text → Speech)
const synth = window.speechSynthesis;

function speak(text) {
  if (!("speechSynthesis" in window)) {
    addMessage("assistant", "Voice output is not supported in this browser.");
    return;
  }

  // Stop anything currently speaking
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 1;
  utterance.pitch = 1;

  orbSetState("speaking");

  utterance.onend = () => {
    orbSetState("idle");
  };

  synth.speak(utterance);
}

function stopSpeaking() {
  if (synth && synth.speaking) {
    synth.cancel();
    orbSetState("idle");
  }
}

// SECTION: Speech Recognition (Voice → Text)
let recognition;
let isListening = false;

if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isListening = true;
    connectionStatus.textContent = "Listening…";
    micLabel.textContent = "Listening";
    micButton.classList.add("listening");
    orbSetState("listening");
  };

  recognition.onerror = (event) => {
    isListening = false;
    micButton.classList.remove("listening");
    orbSetState("idle");

    if (event.error === "not-allowed") {
      addMessage(
        "system",
        "Microphone access was blocked. Please allow mic permissions and try again."
      );
      connectionStatus.textContent = "Mic blocked";
    } else {
      addMessage("system", `Recognition error: ${event.error}`);
      connectionStatus.textContent = "Ready";
    }
  };

  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove("listening");
    micLabel.textContent = "Hold to talk";
    connectionStatus.textContent = "Ready";
    orbSetState("idle");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.trim();
    handleUserQuery(transcript);
  };
} else {
  connectionStatus.textContent = "Voice input unsupported";
  addMessage(
    "system",
    "This browser does not support Web Speech recognition. Try using Chrome or Edge on desktop."
  );
}

// SECTION: Conversation UI
function addMessage(role, text) {
  const message = document.createElement("div");
  message.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "You" : role === "assistant" ? "AI" : "!";

  const body = document.createElement("div");
  body.className = "message-body";

  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "You" : role === "assistant" ? "Nova" : "System";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  if (role === "system") bubble.classList.add("system-text");
  bubble.textContent = text;

  body.appendChild(label);
  body.appendChild(bubble);
  message.appendChild(avatar);
  message.appendChild(body);

  conversationEl.appendChild(message);
  conversationEl.scrollTop = conversationEl.scrollHeight;
}

// SECTION: Orb state changes
function orbSetState(state) {
  orbCore.classList.remove("listening", "speaking");

  if (state === "listening") {
    orbCore.classList.add("listening");
  } else if (state === "speaking") {
    orbCore.classList.add("speaking");
  } else {
    // idle
  }
}

// SECTION: Command Handling
function handleUserQuery(rawText) {
  const text = rawText.toLowerCase();
  addMessage("user", rawText);

  // WhatsApp command pattern
  if (text.includes("whatsapp")) {
    handleWhatsAppCommand(text);
    return;
  }

  // Open app/website commands
  if (text.startsWith("open ") || text.includes("open youtube") || text.includes("open gmail") || text.includes("open facebook")) {
    handleOpenApp(text);
    return;
  }

  // Otherwise treat as general question
  handleGeneralQuestion(rawText);
}

// Open external sites
function handleOpenApp(text) {
  let url = null;
  let label = "";

  if (text.includes("youtube")) {
    url = "https://www.youtube.com";
    label = "YouTube";
  } else if (text.includes("gmail") || text.includes("email")) {
    url = "https://mail.google.com";
    label = "Gmail";
  } else if (text.includes("facebook")) {
    url = "https://www.facebook.com";
    label = "Facebook";
  }

  if (!url) {
    const reply = "I can open YouTube, Gmail, or Facebook. Please say, for example, 'open YouTube'.";
    addMessage("assistant", reply);
    speak(reply);
    return;
  }

  window.open(url, "_blank");
  const reply = `Opening ${label} in a new tab.`;
  addMessage("assistant", reply);
  speak(reply);
}

// WhatsApp messaging using wa.me links
function handleWhatsAppCommand(text) {
  // Example phrases: "send whatsapp message to Alex saying I am on my way"
  const lower = text.toLowerCase();

  const sayingIndex = lower.indexOf("saying ");
  let message = "Hi";

  if (sayingIndex !== -1) {
    message = text.substring(sayingIndex + 7).trim();
  }

  // IMPORTANT: Web pages cannot pick a specific contact.
  // We prepare a generic WhatsApp link; the user chooses the contact.
  const encoded = encodeURIComponent(message || "Hi");
  const waUrl = `https://wa.me/?text=${encoded}`;

  window.open(waUrl, "_blank");

  const reply =
    "I have opened WhatsApp with your message pre-filled. Please pick the contact and press send.";
  addMessage("assistant", reply);
  speak(reply);
}

// General knowledge via web search
function handleGeneralQuestion(question) {
  // Provide answer text AND optionally help user search
  const reply =
    "I will give you a brief answer and also open a search page with more details.";
  addMessage("assistant", reply);
  speak(reply);

  // Open search in a new tab
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    question
  )}`;
  window.open(searchUrl, "_blank");
}

// SECTION: Event Listeners
if (recognition) {
  // Press-and-hold behaviour for mic
  micButton.addEventListener("mousedown", () => {
    if (!isListening) {
      try {
        recognition.start();
      } catch (e) {
        // can throw if already started; ignore
      }
    }
  });

  micButton.addEventListener("mouseup", () => {
    if (isListening) {
      recognition.stop();
    }
  });

  micButton.addEventListener("mouseleave", () => {
    if (isListening) {
      recognition.stop();
    }
  });

  // For touch devices
  micButton.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (!isListening) {
      try {
        recognition.start();
      } catch (e2) {}
    }
  });

  micButton.addEventListener("touchend", () => {
    if (isListening) {
      recognition.stop();
    }
  });
}

stopSpeechBtn.addEventListener("click", () => {
  stopSpeaking();
});

shortcutChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const command = chip.getAttribute("data-command");
    if (!command) return;
    handleUserQuery(command);
  });
});

// Initial welcome message
addMessage(
  "assistant",
  "Hello, I am Nova. Hold the microphone button and ask a question, or say 'open YouTube' or 'send WhatsApp message'."
);
