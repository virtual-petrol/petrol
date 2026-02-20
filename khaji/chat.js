import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

const firebaseConfig = {
  apiKey: "AIzaSyBtPQ_HcTZtqlPuQ11awTUOIiPjvpMNWlU",
  authDomain: "khaji-23a99.firebaseapp.com",
  projectId: "khaji-23a99",
  storageBucket: "khaji-23a99.firebasestorage.app",
  messagingSenderId: "84794766200",
  appId: "1:84794766200:web:207a50412961d45275ce8d",
  measurementId: "G-2RE1L7HQTZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentChatUser = null;
let unsubscribeMessages = null;
let allUsers = [];

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    loadUsers();
  }
});

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

function renderUsers(users) {
  const list = document.getElementById("user-list");
  list.innerHTML = "";

  users.forEach(user => {
    const div = document.createElement("div");
    div.className = "user-item";
    div.innerHTML = `<div>${user.username}</div>`;
    div.onclick = () => startChat(user);
    list.appendChild(div);
  });
}

window.searchUsers = function () {
  const search = document.getElementById("search-input").value.toLowerCase();
  const filtered = allUsers.filter(user =>
    user.username.toLowerCase().includes(search) ||
    user.email.toLowerCase().includes(search)
  );
  renderUsers(filtered);
};

function startChat(user) {
  currentChatUser = user;
  document.getElementById("chat-header").innerText = user.username;

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
      div.innerText = msg.text;
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  });
}

window.sendMessage = async function () {
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

window.handleEnter = function (e) {
  if (e.key === "Enter") sendMessage();
};

window.logout = function () {
  signOut(auth);
};
