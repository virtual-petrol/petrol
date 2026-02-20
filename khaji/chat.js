import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, addDoc, onSnapshot, orderBy, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtPQ_HcTZtqlPuQ11awTUOIiPjvpMNWlU",
  authDomain: "khaji-23a99.firebaseapp.com",
  projectId: "khaji-23a99",
  storageBucket: "khaji-23a99.firebasestorage.app",
  messagingSenderId: "84794766200",
  appId: "1:84794766200:web:6f67917ca967334675ce8d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentChatUserId = null;
let unsubscribeMessages = null;

// Auth check
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
  }
});

// Search Users
window.searchUsers = async function() {
  const email = document.getElementById("search-input").value;
  if (!email) return;

  const q = query(collection(db, "users"), where("email", "==", email));
  const snapshot = await getDocs(q);

  const list = document.getElementById("user-list");
  list.innerHTML = "";

  snapshot.forEach(docSnap => {
    if (docSnap.id !== currentUser.uid) {
      const data = docSnap.data();
      const div = document.createElement("div");
      div.className = "user-item";
      div.innerHTML = `
        <div class="user-avatar">${data.username[0].toUpperCase()}</div>
        <div>${data.username}</div>
      `;
      div.onclick = () => startChat(docSnap.id, data.username, div);
      list.appendChild(div);
    }
  });
};

// Start Chat
function startChat(userId, username, element) {
  currentChatUserId = userId;

  document.querySelectorAll(".user-item").forEach(el => el.classList.remove("active"));
  element.classList.add("active");

  document.getElementById("chat-header").innerHTML = `<h3>${username}</h3>`;
  const container = document.getElementById("messages-container");
  container.innerHTML = "";

  const chatId = [currentUser.uid, userId].sort().join("_");
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("createdAt"));

  if (unsubscribeMessages) unsubscribeMessages();

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    container.innerHTML = "";
    snapshot.forEach(doc => {
      const msg = doc.data();
      const div = document.createElement("div");
      div.className = `message-row ${msg.senderId === currentUser.uid ? "sent" : "received"}`;
      div.innerHTML = `<div class="message-bubble">${msg.text}</div>`;
      container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
  });
}

// Send Message
window.sendMessage = async function() {
  const input = document.getElementById("message-input");
  const text = input.value.trim();
  if (!text || !currentChatUserId) return;

  const chatId = [currentUser.uid, currentChatUserId].sort().join("_");
  const messagesRef = collection(db, "chats", chatId, "messages");

  await addDoc(messagesRef, {
    text,
    senderId: currentUser.uid,
    createdAt: serverTimestamp()
  });

  input.value = "";
};

// Enter key
window.handleEnter = function(e) {
  if (e.key === "Enter") sendMessage();
};

// Logout
window.logout = function() {
  signOut(auth);
};
