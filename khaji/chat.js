import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  addDoc, 
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBtPQ_HcTZtqlPuQ11awTUOIiPjvpMNWlU",
  authDomain: "khaji-23a99.firebaseapp.com",
  projectId: "khaji-23a99",
  storageBucket: "khaji-23a99.firebasestorage.app",
  messagingSenderId: "84794766200",
  appId: "1:84794766200:web:6f67917ca967334675ce8d"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentChatUser = null;
let unsubscribeMessages = null;
let allUsers = [];

// 🔐 Auth Check
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    loadUsers();
  }
});

// 👥 Load All Users
async function loadUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  allUsers = [];

  snapshot.forEach(docSnap => {
    if (docSnap.id !== currentUser.uid) {
      allUsers.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    }
  });

  renderUsers(allUsers);
}

// 🎨 Render Users
function renderUsers(users) {
  const list = document.getElementById("user-list");
  list.innerHTML = "";

  users.forEach(user => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerHTML = `
      <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
      <div>${user.username}</div>
    `;

    div.onclick = () => startChat(user, div);
    list.appendChild(div);
  });
}

// 🔍 Search
window.searchUsers = function() {
  const search = document.getElementById("search-input").value.toLowerCase();

  const filtered = allUsers.filter(user =>
    user.username.toLowerCase().includes(search) ||
    user.email.toLowerCase().includes(search)
  );

  renderUsers(filtered);
};

// 💬 Start Chat
function startChat(user, element) {
  currentChatUser = user;

  document.querySelectorAll(".user-item").forEach(el => el.classList.remove("active"));
  element.classList.add("active");

  document.getElementById("chat-header").innerHTML = `<h3>${user.username}</h3>`;

  const chatId = [currentUser.uid, user.id].sort().join("_");
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("createdAt"));

  if (unsubscribeMessages) unsubscribeMessages();

  unsubscribeMessages = onSnapshot(q, snapshot => {
    const container = document.getElementById("messages-container");
    container.innerHTML = "";

    snapshot.forEach(doc => {
      const msg = doc.data();
      const div = document.createElement("div");
      div.className = `message-row ${
        msg.senderId === currentUser.uid ? "sent" : "received"
      }`;

      div.innerHTML = `<div class="message-bubble">${msg.text}</div>`;
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  });
}

// ✉ Send Message
window.sendMessage = async function() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();

  if (!text || !currentChatUser) return;

  const chatId = [currentUser.uid, currentChatUser.id].sort().join("_");
  const messagesRef = collection(db, "chats", chatId, "messages");

  await addDoc(messagesRef, {
    text,
    senderId: currentUser.uid,
    createdAt: serverTimestamp()
  });

  input.value = "";
};

// ⌨ Enter key
window.handleEnter = function(e) {
  if (e.key === "Enter") {
    sendMessage();
  }
};

// 🚪 Logout
window.logout = function() {
  signOut(auth);
};
