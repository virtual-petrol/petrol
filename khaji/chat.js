const firebaseConfig = {
  apiKey: "AIzaSyBtPQ_HcTZtqlPuQ11awTUOIiPjvpMNWlU",
  authDomain: "khaji-23a99.firebaseapp.com",
  databaseURL: "https://khaji-23a99-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "khaji-23a99",
  storageBucket: "khaji-23a99.firebasestorage.app",
  messagingSenderId: "84794766200",
  appId: "1:84794766200:web:207a50412961d45275ce8d",
  measurementId: "G-2RE1L7HQTZ"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentChatUser = null;
let unsubscribeMessages = null;

// ================= AUTH CHECK =================
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    console.log("Logged in as:", user.email);
  }
});

// ================= SEARCH USER =================
document.getElementById("searchBtn").addEventListener("click", async () => {
  const emailInput = document.getElementById("searchEmail");
  const email = emailInput.value.trim();

  if (!email) {
    alert("Enter email to search");
    return;
  }

  console.log("Searching for:", email);

  try {
    const snapshot = await db.collection("users")
      .where("email", "==", email)
      .get();

    console.log("Found:", snapshot.size);

    const userList = document.getElementById("userList");
    userList.innerHTML = "";

    if (snapshot.empty) {
      userList.innerHTML = "<p>No user found</p>";
      return;
    }

    snapshot.forEach(doc => {
      if (doc.id !== currentUser.uid) {
        const data = doc.data();

        const btn = document.createElement("button");
        btn.innerText = data.username + " (" + data.email + ")";
        btn.style.display = "block";
        btn.style.margin = "5px 0";

        btn.onclick = () => startChat(doc.id, data.username);

        userList.appendChild(btn);
      }
    });

  } catch (error) {
    console.error("Search error:", error);
  }
});

// ================= START CHAT =================
function startChat(userId, username) {
  currentChatUser = userId;

  document.getElementById("chatBox").innerHTML =
    "<h4>Chatting with " + username + "</h4>";

  loadMessages();
}

// ================= LOAD MESSAGES =================
function loadMessages() {

  if (!currentChatUser) return;

  const chatId = [currentUser.uid, currentChatUser].sort().join("_");

  // Stop old listener if exists
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  unsubscribeMessages = db.collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt")
    .onSnapshot(snapshot => {

      const chatBox = document.getElementById("chatBox");
      chatBox.innerHTML = "";

      snapshot.forEach(doc => {
        const msg = doc.data();

        const div = document.createElement("div");
        div.style.margin = "5px 0";

        if (msg.senderId === currentUser.uid) {
          div.style.textAlign = "right";
          div.innerHTML =
            "<span style='background:#4CAF50;color:white;padding:5px 10px;border-radius:10px;display:inline-block'>" +
            msg.text +
            "</span>";
        } else {
          div.style.textAlign = "left";
          div.innerHTML =
            "<span style='background:#ddd;padding:5px 10px;border-radius:10px;display:inline-block'>" +
            msg.text +
            "</span>";
        }

        chatBox.appendChild(div);
      });

      // Auto scroll bottom
      chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// ================= SEND MESSAGE =================
document.getElementById("sendBtn").addEventListener("click", async () => {

  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;
  if (!currentChatUser) {
    alert("Select user first");
    return;
  }

  const chatId = [currentUser.uid, currentChatUser].sort().join("_");

  try {
    await db.collection("chats")
      .doc(chatId)
      .collection("messages")
      .add({
        text: text,
        senderId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    input.value = "";

  } catch (error) {
    console.error("Send error:", error);
  }
});

// ================= LOGOUT =================
document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
});
