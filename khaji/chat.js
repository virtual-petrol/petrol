// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBtPQ_HcTZtqlPuQ11awTUOIiPjvpMNWlU",
  authDomain: "khaji-23a99.firebaseapp.com",
  projectId: "khaji-23a99",
  storageBucket: "khaji-23a99.firebasestorage.app",
  messagingSenderId: "84794766200",
  appId: "1:84794766200:web:207a50412961d45275ce8d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let currentChatUser = null;
let currentChatUserData = null;
let unsubscribeMessages = null;
let unsubscribeUsers = null;

// ================= CHECK AUTH =================
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }
  
  currentUser = user;
  console.log("✅ Logged in:", user.email);
  
  // Update online status
  try {
    await db.collection("users").doc(user.uid).update({
      isOnline: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.log("First time user - profile exists");
  }
  
  // Load all users
  loadAllUsers();
});

// ================= LOAD ALL USERS =================
async function loadAllUsers() {
  try {
    const snapshot = await db.collection("users").get();
    const userList = document.getElementById("userList");
    userList.innerHTML = "";
    
    if (snapshot.empty) {
      userList.innerHTML = '<div class="no-user">No users found. Register first!</div>';
      return;
    }
    
    let userCount = 0;
    
    snapshot.forEach(doc => {
      if (doc.id !== currentUser?.uid) {
        userCount++;
        const userData = doc.data();
        displayUser(doc.id, userData);
      }
    });
    
    if (userCount === 0) {
      userList.innerHTML = '<div class="no-user">No other users found. Share this app with friends!</div>';
    }
    
  } catch (error) {
    console.error("Error loading users:", error);
    document.getElementById("userList").innerHTML = '<div class="no-user">Error loading users</div>';
  }
}

// ================= DISPLAY USER =================
function displayUser(userId, userData) {
  const userList = document.getElementById("userList");
  
  const userDiv = document.createElement("div");
  userDiv.className = "user-item";
  userDiv.id = `user-${userId}`;
  
  const avatar = userData.username?.charAt(0).toUpperCase() || 'U';
  const isOnline = userData.isOnline || false;
  
  userDiv.innerHTML = `
    <div class="user-avatar">${avatar}</div>
    <div class="user-info">
      <div class="user-name">
        ${userData.username || 'User'}
        <span class="${isOnline ? 'online-dot' : 'offline-dot'}"></span>
      </div>
      <div class="user-email">${userData.email}</div>
    </div>
  `;
  
  userDiv.addEventListener('click', () => startChat(userId, userData));
  
  userList.appendChild(userDiv);
}

// ================= SEARCH USERS =================
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
      userList.innerHTML = '<div class="no-user">No users found</div>';
      return;
    }
    
    snapshot.forEach(doc => {
      if (doc.id !== currentUser.uid) {
        displayUser(doc.id, doc.data());
      }
    });
    
  } catch (error) {
    console.error("Search error:", error);
  }
});

// ================= START CHAT =================
async function startChat(userId, userData) {
  currentChatUser = userId;
  currentChatUserData = userData;
  
  // Update UI
  document.querySelectorAll('.user-item').forEach(el => {
    el.classList.remove('selected');
  });
  document.getElementById(`user-${userId}`).classList.add('selected');
  
  // Update header
  const avatar = userData.username?.charAt(0).toUpperCase() || 'U';
  const isOnline = userData.isOnline ? '🟢 Online' : '⚪ Offline';
  
  document.getElementById("chatHeader").innerHTML = `
    <div class="chat-header-avatar">${avatar}</div>
    <div class="chat-header-info">
      <h4>${userData.username || 'User'}</h4>
      <p>${isOnline}</p>
    </div>
  `;
  
  // Load messages
  loadMessages();
  
  // Mark messages as read
  markMessagesAsRead(userId);
}

// ================= MARK MESSAGES AS READ =================
async function markMessagesAsRead(otherUserId) {
  const chatId = [currentUser.uid, otherUserId].sort().join("_");
  
  try {
    const messagesSnapshot = await db.collection("chats")
      .doc(chatId)
      .collection("messages")
      .where("receiverId", "==", currentUser.uid)
      .where("status", "in", ["sent", "delivered"])
      .get();
    
    const batch = db.batch();
    messagesSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: "read",
        readAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
  } catch (error) {
    console.log("Mark as read error:", error);
  }
}

// ================= LOAD MESSAGES =================
function loadMessages() {
  if (!currentChatUser) return;
  
  const chatId = [currentUser.uid, currentChatUser].sort().join("_");
  
  // Stop old listener
  if (unsubscribeMessages) {
    unsubscribeMessages();
  }
  
  // Create chat document if not exists
  db.collection("chats").doc(chatId).get().then(doc => {
    if (!doc.exists) {
      db.collection("chats").doc(chatId).set({
        participants: [currentUser.uid, currentChatUser],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  });
  
  // Listen to messages
  unsubscribeMessages = db.collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt")
    .onSnapshot(snapshot => {
      const chatBox = document.getElementById("chatBox");
      chatBox.innerHTML = "";
      
      if (snapshot.empty) {
        chatBox.innerHTML = '<div class="no-user">No messages yet. Say hi! 👋</div>';
        return;
      }
      
      snapshot.forEach(doc => {
        const msg = doc.data();
        
        // Update message status
        if (msg.receiverId === currentUser.uid && msg.status === "sent") {
          doc.ref.update({ status: "delivered" });
        }
        
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
        
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.textContent = msg.text;
        
        // Add time
        const timeSpan = document.createElement("div");
        timeSpan.className = "message-time";
        
        if (msg.createdAt?.toDate) {
          const time = msg.createdAt.toDate().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          
          // Add status for sent messages
          if (msg.senderId === currentUser.uid) {
            let status = '✓';
            if (msg.status === 'delivered') status = '✓✓';
            if (msg.status === 'read') status = '✓✓';
            timeSpan.textContent = `${time} ${status}`;
          } else {
            timeSpan.textContent = time;
          }
        }
        
        bubble.appendChild(timeSpan);
        messageDiv.appendChild(bubble);
        chatBox.appendChild(messageDiv);
      });
      
      // Auto-scroll
      chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// ================= SEND MESSAGE =================
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
    // Send message
    await db.collection("chats")
      .doc(chatId)
      .collection("messages")
      .add({
        text: text,
        senderId: currentUser.uid,
        receiverId: currentChatUser,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "sent"
      });
    
    // Update last message
    await db.collection("chats").doc(chatId).set({
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
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
  if (unsubscribeUsers) unsubscribeUsers();
  
  auth.signOut();
});

// ================= REAL-TIME USER UPDATES =================
function setupUserListener() {
  if (unsubscribeUsers) {
    unsubscribeUsers();
  }
  
  unsubscribeUsers = db.collection("users").onSnapshot(snapshot => {
    // Update online status in UI
    snapshot.forEach(doc => {
      const userData = doc.data();
      const userElement = document.getElementById(`user-${doc.id}`);
      
      if (userElement) {
        const dot = userElement.querySelector('.online-dot, .offline-dot');
        if (dot) {
          dot.className = userData.isOnline ? 'online-dot' : 'offline-dot';
        }
      }
    });
  });
}

// Call this after auth
setupUserListener();
