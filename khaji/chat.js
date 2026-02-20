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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentChatUser = null;
let currentChatUserData = null;
let unsubscribeMessages = null;
let unsubscribeUsers = null;

// ================= AUTH CHECK =================
auth.onAuthStateChanged(async user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    console.log("✅ Logged in as:", user.email);
    
    try {
      // Update user online status in users collection
      await db.collection("users").doc(user.uid).update({
        isOnline: true,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      // First time user - create profile
      console.log("Creating new user profile...");
      await db.collection("users").doc(user.uid).set({
        username: user.email.split('@')[0],
        email: user.email,
        isOnline: true,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "Hey there! I'm using Khaji Chat"
      });
    }
    
    // Load all users
    loadAllUsers();
  }
});

// ================= LOAD ALL USERS =================
async function loadAllUsers() {
  try {
    const snapshot = await db.collection("users").get();
    const userList = document.getElementById("userList");
    userList.innerHTML = "";
    
    if (snapshot.empty) {
      userList.innerHTML = "<p style='padding:20px; text-align:center;'>No users found. Register first!</p>";
      return;
    }
    
    snapshot.forEach(doc => {
      if (doc.id !== currentUser?.uid) {
        const userData = doc.data();
        createUserElement(doc.id, userData);
      }
    });
  } catch (error) {
    console.error("Error loading users:", error);
    document.getElementById("userList").innerHTML = "<p style='color:red;'>Error loading users</p>";
  }
}

// ================= CREATE USER ELEMENT =================
function createUserElement(userId, userData) {
  const userList = document.getElementById("userList");
  
  const userDiv = document.createElement("div");
  userDiv.className = "user-item";
  userDiv.id = `user-${userId}`;
  userDiv.style.cssText = `
    padding: 12px 15px;
    margin: 5px 10px;
    background: ${userData.isOnline ? '#f0fdf4' : '#f9fafb'};
    border-radius: 10px;
    cursor: pointer;
    border: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.2s;
  `;
  
  // Avatar
  const avatar = document.createElement("div");
  avatar.style.cssText = `
    width: 45px;
    height: 45px;
    background: #6366f1;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 18px;
  `;
  avatar.textContent = userData.username ? userData.username.charAt(0).toUpperCase() : 'U';
  
  // Info
  const info = document.createElement("div");
  info.style.flex = "1";
  info.innerHTML = `
    <div style="font-weight:600; display:flex; align-items:center; gap:5px;">
      ${userData.username || 'User'}
      <span style="color: ${userData.isOnline ? '#22c55e' : '#94a3b8'}; font-size: 12px;">
        ${userData.isOnline ? '● Online' : '○ Offline'}
      </span>
    </div>
    <div style="font-size:13px; color:#666;">${userData.email}</div>
    ${userData.status ? `<div style="font-size:11px; color:#888;">${userData.status}</div>` : ''}
  `;
  
  userDiv.appendChild(avatar);
  userDiv.appendChild(info);
  
  userDiv.onclick = () => startChat(userId, userData);
  
  userList.appendChild(userDiv);
}

// ================= SEARCH USER =================
document.getElementById("searchBtn").addEventListener("click", async () => {
  const email = document.getElementById("searchEmail").value.trim();
  
  if (!email) {
    loadAllUsers();
    return;
  }
  
  try {
    const snapshot = await db.collection("users")
      .where("email", ">=", email)
      .where("email", "<=", email + '\uf8ff')
      .get();
    
    const userList = document.getElementById("userList");
    userList.innerHTML = "";
    
    if (snapshot.empty) {
      userList.innerHTML = "<p style='padding:20px;'>No user found</p>";
      return;
    }
    
    snapshot.forEach(doc => {
      if (doc.id !== currentUser.uid) {
        createUserElement(doc.id, doc.data());
      }
    });
  } catch (error) {
    console.error("Search error:", error);
  }
});

// ================= START CHAT =================
function startChat(userId, userData) {
  currentChatUser = userId;
  currentChatUserData = userData;
  
  // Highlight selected user
  document.querySelectorAll('.user-item').forEach(el => {
    el.style.background = '';
  });
  document.getElementById(`user-${userId}`).style.background = '#e0e7ff';
  
  // Update header
  document.getElementById("chatHeader").innerHTML = `
    <div style="display:flex; align-items:center; gap:10px;">
      <div style="width:40px; height:40px; background:#6366f1; color:white; border-radius:50%; display:flex; align-items:center; justify-content:center;">
        ${userData.username ? userData.username.charAt(0).toUpperCase() : 'U'}
      </div>
      <div>
        <div style="font-weight:600;">${userData.username || 'User'}</div>
        <div style="font-size:12px; color:${userData.isOnline ? '#22c55e' : '#666'};">
          ${userData.isOnline ? 'Online' : 'Offline'}
        </div>
      </div>
    </div>
  `;
  
  loadMessages();
}

// ================= LOAD MESSAGES (from chats/{chatId}/messages) =================
function loadMessages() {
  if (!currentChatUser) return;
  
  const chatId = [currentUser.uid, currentChatUser].sort().join("_");
  
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }
  
  // Create chat document if it doesn't exist
  db.collection("chats").doc(chatId).get().then(doc => {
    if (!doc.exists) {
      db.collection("chats").doc(chatId).set({
        participants: [currentUser.uid, currentChatUser],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: {
          [currentUser.uid]: 0,
          [currentChatUser]: 0
        }
      });
    }
  });
  
  // Listen to messages subcollection
  unsubscribeMessages = db.collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt")
    .onSnapshot(snapshot => {
      const chatBox = document.getElementById("chatBox");
      chatBox.innerHTML = "";
      
      if (snapshot.empty) {
        chatBox.innerHTML = "<p style='text-align:center; color:#666; padding:20px;'>No messages yet. Say hi! 👋</p>";
        return;
      }
      
      snapshot.forEach(doc => {
        const msg = doc.data();
        
        // Mark as delivered if received
        if (msg.receiverId === currentUser.uid && msg.status === 'sent') {
          doc.ref.update({
            status: 'delivered'
          });
        }
        
        const messageDiv = document.createElement("div");
        messageDiv.style.cssText = `
          display: flex;
          margin: 15px 10px;
          justify-content: ${msg.senderId === currentUser.uid ? 'flex-end' : 'flex-start'};
        `;
        
        const bubble = document.createElement("div");
        bubble.style.cssText = `
          max-width: 70%;
          padding: 12px 18px;
          border-radius: 18px;
          background: ${msg.senderId === currentUser.uid ? '#6366f1' : '#e5e7eb'};
          color: ${msg.senderId === currentUser.uid ? 'white' : 'black'};
          border-bottom-${msg.senderId === currentUser.uid ? 'right' : 'left'}-radius: 4px;
          word-wrap: break-word;
        `;
        
        // Message text
        bubble.innerHTML = msg.text;
        
        // Time and status
        if (msg.createdAt) {
          const timeSpan = document.createElement("span");
          timeSpan.style.cssText = "font-size: 10px; margin-left: 8px; opacity: 0.7; display: inline-block;";
          
          let timeStr = '';
          if (msg.createdAt.toDate) {
            timeStr = msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          } else {
            timeStr = 'just now';
          }
          
          // Add status indicators for sent messages
          if (msg.senderId === currentUser.uid) {
            let statusIcon = '';
            if (msg.status === 'sent') statusIcon = ' ✓';
            else if (msg.status === 'delivered') statusIcon = ' ✓✓';
            else if (msg.status === 'read') statusIcon = ' ✓✓';
            timeSpan.textContent = `${timeStr}${statusIcon}`;
          } else {
            timeSpan.textContent = timeStr;
          }
          
          bubble.appendChild(document.createElement("br"));
          bubble.appendChild(timeSpan);
        }
        
        messageDiv.appendChild(bubble);
        chatBox.appendChild(messageDiv);
      });
      
      // Auto-scroll
      chatBox.scrollTop = chatBox.scrollHeight;
    }, error => {
      console.error("Message load error:", error);
      document.getElementById("chatBox").innerHTML = "<p style='color:red;'>Error loading messages</p>";
    });
}

// ================= SEND MESSAGE (to chats/{chatId}/messages) =================
document.getElementById("sendBtn").addEventListener("click", sendMessage);
document.getElementById("messageInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

async function sendMessage() {
  const input = document.getElementById("messageInput");
  const text = input.value.trim();
  
  if (!text) return;
  if (!currentChatUser) {
    alert("Please select a user first");
    return;
  }
  
  const chatId = [currentUser.uid, currentChatUser].sort().join("_");
  
  try {
    // Add message to messages subcollection
    await db.collection("chats")
      .doc(chatId)
      .collection("messages")
      .add({
        text: text,
        senderId: currentUser.uid,
        receiverId: currentChatUser,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "sent",
        type: "text"
      });
    
    // Update chat document with last message
    await db.collection("chats").doc(chatId).update({
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      [`unreadCount.${currentChatUser}`]: firebase.firestore.FieldValue.increment(1)
    });
    
    input.value = "";
    
  } catch (error) {
    console.error("Send error:", error);
    alert("Failed to send: " + error.message);
  }
}

// ================= LOGOUT =================
document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    if (currentUser) {
      await db.collection("users").doc(currentUser.uid).update({
        isOnline: false,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.log("Logout error:", error);
  }
  
  if (unsubscribeMessages) unsubscribeMessages();
  auth.signOut();
});
