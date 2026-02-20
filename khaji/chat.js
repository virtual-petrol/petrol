import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, addDoc, orderBy, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration (Same as before)
const firebaseConfig = {
  apiKey: "AIzaSyBtPQ_HcTZtqlPuQ11awTUOIiPjvpMNWlU",
  authDomain: "khaji-23a99.firebaseapp.com",
  databaseURL: "https://khaji-23a99-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "khaji-23a99",
  storageBucket: "khaji-23a99.firebasestorage.app",
  messagingSenderId: "84794766200",
  appId: "1:84794766200:web:6f67917ca967334675ce8d",
  measurementId: "G-QQQQ2ERH10"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State
let currentUser = null;
let currentChatUserId = null;
let currentChatUserData = null;
let unsubChat = null; // To unsubscribe from messages
let peer = null; // PeerJS instance
let localStream = null;
let currentCall = null;

// --- Initialization ---
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    initPeerJS(user.uid);
  }
});

// Initialize PeerJS for Video
function initPeerJS(uid) {
  peer = new Peer(uid, {
    debug: 2
  });

  peer.on('open', (id) => {
    console.log('My peer ID is: ' + id);
  });

  // Handle incoming call
  peer.on('call', (call) => {
    currentCall = call;
    document.getElementById('caller-name').innerText = "Incoming call...";
    document.getElementById('call-modal').classList.remove('hidden');
  });
}

// --- User Search & List ---
window.searchUsers = async function() {
  const emailQuery = document.getElementById('search-input').value;
  if (!emailQuery) return;

  const q = query(collection(db, "users"), where("email", "==", emailQuery));
  const querySnapshot = await getDocs(q);
  
  const listContainer = document.getElementById('user-list');
  listContainer.innerHTML = ''; // Clear list

  querySnapshot.forEach((doc) => {
    if (doc.id !== currentUser.uid) {
      const userData = doc.data();
      const div = document.createElement('div');
      div.className = 'user-item';
      div.innerHTML = `
        <div class="user-avatar">${userData.username.charAt(0).toUpperCase()}</div>
        <div class="user-info">
          <h4>${userData.username}</h4>
          <p>${userData.email}</p>
        </div>
      `;
      div.onclick = () => startChat(doc.id, userData);
      listContainer.appendChild(div);
    }
  });
}

// --- Chat Logic ---
window.startChat = async function(userId, userData) {
  currentChatUserId = userId;
  currentChatUserData = userData;
  
  // UI Updates
  document.querySelector('.chat-header').innerHTML = `<h3>${userData.username}</h3>`;
  document.querySelector('.messages-container').innerHTML = '';
  
  // Create a unique Chat Room ID (Sorted UIDs to ensure same room for both)
  const chatId = [currentUser.uid, userId].sort().join('_');
  
  // Listen for messages
  if (unsubChat) unsubChat(); // Unsubscribe previous
  
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("createdAt"));
  
  unsubChat = onSnapshot(q, (snapshot) => {
    const container = document.getElementById('messages-container');
    // Optional: Clear container only once or append new efficiently
    // For simplicity, we just append new messages logic could be added
    
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const msg = change.doc.data();
        const div = document.createElement('div');
        div.className = `message-row ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
        div.innerHTML = `<div class="message-bubble">${msg.text}</div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
      }
    });
  });
}

window.sendMessage = async function() {
  const input = document.getElementById('message-input');
  const text = input.value;
  if (!text || !currentChatUserId) return;

  const chatId = [currentUser.uid, currentChatUserId].sort().join('_');
  const messagesRef = collection(db, "chats", chatId, "messages");

  await addDoc(messagesRef, {
    text: text,
    senderId: currentUser.uid,
    createdAt: serverTimestamp()
  });

  input.value = '';
}

window.handleEnter = function(e) {
  if (e.key === 'Enter') sendMessage();
}

window.logout = function() {
  signOut(auth);
}

// --- Video Call Logic ---

window.startVideoCall = async function() {
  if (!currentChatUserId) return alert("Select a user first");
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream = stream;
    
    document.getElementById('video-grid').classList.remove('hidden');
    document.getElementById('local-video').srcObject = stream;
    
    // Call the other user using their UID as PeerID
    const call = peer.call(currentChatUserId, stream);
    
    call.on('stream', (remoteStream) => {
      document.getElementById('remote-video').srcObject = remoteStream;
    });
    
  } catch(err) {
    console.error("Failed to get local stream", err);
    alert("Camera permission denied");
  }
}

// Receiving Call
window.answerCall = async function() {
  document.getElementById('call-modal').classList.add('hidden');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream = stream;
    
    document.getElementById('video-grid').classList.remove('hidden');
    document.getElementById('local-video').srcObject = stream;
    
    // Answer the call
    currentCall.answer(stream);
    
    currentCall.on('stream', (remoteStream) => {
      document.getElementById('remote-video').srcObject = remoteStream;
    });
  } catch(err) {
    alert("Camera permission denied");
  }
}

window.rejectCall = function() {
  document.getElementById('call-modal').classList.add('hidden');
  if(currentCall) currentCall.close();
}
