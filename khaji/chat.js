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

let currentUser;
let currentChatUser;

auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
  }
});

document.getElementById("searchBtn").addEventListener("click", async () => {
  const email = document.getElementById("searchEmail").value.trim();
  const snapshot = await db.collection("users")
    .where("email", "==", email)
    .get();

  const userList = document.getElementById("userList");
  userList.innerHTML = "";

  snapshot.forEach(doc => {
    if (doc.id !== currentUser.uid) {
      const btn = document.createElement("button");
      btn.innerText = doc.data().username;
      btn.onclick = () => startChat(doc.id);
      userList.appendChild(btn);
    }
  });
});

function startChat(userId) {
  currentChatUser = userId;
  loadMessages();
}

function loadMessages() {
  const chatId = [currentUser.uid, currentChatUser].sort().join("_");

  db.collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt")
    .onSnapshot(snapshot => {
      const chatBox = document.getElementById("chatBox");
      chatBox.innerHTML = "";

      snapshot.forEach(doc => {
        const msg = doc.data();
        const p = document.createElement("p");
        p.innerText = msg.text;
        chatBox.appendChild(p);
      });
    });
}

document.getElementById("sendBtn").addEventListener("click", async () => {
  const text = document.getElementById("messageInput").value.trim();
  if (!text || !currentChatUser) return;

  const chatId = [currentUser.uid, currentChatUser].sort().join("_");

  await db.collection("chats")
    .doc(chatId)
    .collection("messages")
    .add({
      text: text,
      senderId: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  document.getElementById("messageInput").value = "";
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
});
