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

// Initialize Firebase FIRST
firebase.initializeApp(firebaseConfig);

// Initialize services SECOND
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence (optional)
db.enablePersistence()
  .catch(err => console.log("Persistence error:", err));

// Variables THIRD
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
      // Update user online status
      await db.collection("users").doc(user.uid).update({
        isOnline: true,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.log("Status update error (might be new user):", error.message);
    }
    
    // Load all users after short delay
    setTimeout(() => loadAllUsers(), 1000);
  }
});

// ================= LOAD ALL USERS =================
async function loadAllUsers() {
  console.log("Loading all users...");
  
  // Check if currentUser exists
  if (!currentUser) {
    console.log("Waiting for user to load...");
    return;
  }
  
  try {
    const snapshot = await db.collection("users").get();
    console.log("Users found:", snapshot.size);
    
    const userList = document.getElementById("userList");
    userList.innerHTML = "";
    
    if (snapshot.empty) {
      userList.innerHTML = "<p style='padding:20px; text-align:center; color:#666;'>No users found. Register first!</p>";
      return;
    }
    
    let hasOtherUsers = false;
    
    snapshot.forEach(doc => {
      if (doc.id !== currentUser?.uid) {
        hasOtherUsers = true;
        const data = doc.data();
        console.log("Displaying user:", data.email);
        createUserButton(doc.id, data);
      }
    });
    
    if (!hasOtherUsers) {
      userList.innerHTML = "<p style='padding:20px; text-align:center; color:#666;'>No other users found. Invite friends!</p>";
    }
    
  } catch (error) {
    console.error("❌ Error loading users:", error);
    
    if (error.code === 'permission-denied') {
      document.getElementById("userList").innerHTML = 
        "<p style='padding:20px; text-align:center; color:red;'>❌ Permission denied! Check Firestore Rules.</p>";
    } else {
      document.getElementById("userList").innerHTML = 
        "<p style='padding:20px; text-align:center; color:red;'>Error loading users</p>";
    }
  }
}

// ================= CREATE USER BUTTON =================
function createUserButton(userId, userData) {
  const userList = document.getElementById("userList");
  
  const userDiv = document.createElement("div");
  userDiv.className = "user-item";
  userDiv.id = `user-${userId}`;
  
  const initials = userData.username 
    ? userData.username.substring(0, 2).toUpperCase() 
    : userData.email.substring(0, 2).toUpperCase();
  
  const onlineStatus = userData.isOnline ? '🟢' : '⚪';
  
  userDiv.innerHTML = `
    <div class="user-avatar">${initials}</div>
    <div style="flex:1;">
      <div style="font-weight:600;">
        ${userData.username || 'User'} ${onlineStatus}
      </div>
      <div style="font-size:12px; color:#666;">${userData.email}</div>
    </div>
    <button class="chat-btn" style="background:#6366f1; color:white; border:none; padding:5px 10px; border-radius:5px; cursor:pointer;">
      Chat
    </button>
  `;
  
  userDiv.querySelector('.chat-btn').onclick = (e) => {
    e.stopPropagation();
    startChat(userId, userData);
  };
  
  userList.appendChild(userDiv);
}

// ================= SEARCH USER =================
// Wait for DOM to load
document.addEventListener('DOMContentLoaded', function() {
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) {
    searchBtn.addEventListener("click", searchUsers);
  }
  
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }
  
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  
  const messageInput = document.getElementById("messageInput");
  if (messageInput) {
    messageInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }
});

async function searchUsers() {
  // Check if currentUser exists
  if (!currentUser) {
    alert("Please wait, loading user data...");
    return;
  }
  
  const emailInput = document.getElementById("searchEmail");
  const email = emailInput.value.trim();

  if (!email) {
    loadAllUsers();
    return;
  }

  try {
    const snapshot = await db.collection("users")
      .where("email", "==", email)
      .get();

    const userList = document.getElementById("userList");
    userList.innerHTML = "";

    if (snapshot.empty) {
      userList.innerHTML = "<p style='padding:20px; text-align:center;'>❌ No user found with this email</p>";
      return;
    }

    snapshot.forEach(doc => {
      if (doc.id !== currentUser.uid) {
        const data = doc.data();
        createUserButton(doc.id, data);
      }
    });

  } catch (error) {
    console.error("Search error:", error);
    alert("Search failed: " + error.message);
  }
}

// ================= START CHAT =================
function startChat(userId, userData) {
  if (!currentUser) {
    alert("Please wait, loading user data...");
    return;
  }
  
  currentChatUser = userId;
  currentChatUserData = userData;
  
  document.getElementById("chatHeader").innerHTML = `
    <div>
      <i class="fas fa-user"></i> Chatting with ${userData.username || userData.email}
    </div>
  `;

  loadMessages();
}

// ================= LOAD MESSAGES =================
function loadMessages() {
  if (!currentChatUser || !currentUser) return;

  const chatId = [currentUser.uid, currentChatUser].sort().join("_");
  
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = "<p style='text-align:center;'>Loading messages...</p>";

  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  unsubscribeMessages = db.collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt")
    .onSnapshot(snapshot => {
      chatBox.innerHTML = "";

      if (snapshot.empty) {
        chatBox.innerHTML = "<p style='text-align:center; color:#666;'>No messages yet. Say hi! 👋</p>";
      }

      snapshot.forEach(doc => {
        const msg = doc.data();
        
        const messageRow = document.createElement("div");
        messageRow.style.cssText = `
          display: flex;
          margin: 10px 0;
          ${msg.senderId === currentUser.uid ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
        `;
        
        const messageBubble = document.createElement("div");
        messageBubble.style.cssText = `
          padding: 10px 15px;
          border-radius: 18px;
          max-width: 70%;
          ${msg.senderId === currentUser.uid 
            ? 'background: #6366f1; color: white; border-bottom-right-radius: 4px;' 
            : 'background: #e5e7eb; color: black; border-bottom-left-radius: 4px;'}
        `;
        
        messageBubble.textContent = msg.text;
        
        // Add time if available
        if (msg.createdAt) {
          const timeSpan = document.createElement("span");
          timeSpan.style.cssText = "font-size: 10px; margin-left: 8px; opacity: 0.7;";
          
          if (msg.createdAt && msg.createdAt.toDate) {
            timeSpan.textContent = msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          } else {
            timeSpan.textContent = "just now";
          }
          
          messageBubble.appendChild(timeSpan);
        }
        
        messageRow.appendChild(messageBubble);
        chatBox.appendChild(messageRow);
      });

      chatBox.scrollTop = chatBox.scrollHeight;
    }, error => {
      console.error("Message load error:", error);
      chatBox.innerHTML = "<p style='color:red;'>Error loading messages</p>";
    });
}

// ================= SEND MESSAGE =================
async function sendMessage() {
  if (!currentUser) {
    alert("Please wait, loading user data...");
    return;
  }
  
  if (!currentChatUser) {
    alert("Please select a user first");
    return;
  }
  
  const input = document.getElementById("messageInput");
  const text = input.value.trim();

  if (!text) return;

  const chatId = [currentUser.uid, currentChatUser].sort().join("_");

  try {
    await db.collection("chats")
      .doc(chatId)
      .collection("messages")
      .add({
        text: text,
        senderId: currentUser.uid,
        receiverId: currentChatUser,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    input.value = "";

  } catch (error) {
    console.error("Send error:", error);
    alert("Failed to send: " + error.message);
  }
}

// ================= LOGOUT =================
async function logout() {
  try {
    if (currentUser) {
      await db.collection("users").doc(currentUser.uid).update({
        isOnline: false,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.log("Logout status update error:", error);
  }
  
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeUsers) unsubscribeUsers();
  
  auth.signOut();
}

// Handle browser close/tab close
window.addEventListener("beforeunload", () => {
  if (currentUser) {
    db.collection("users").doc(currentUser.uid).update({
      isOnline: false,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  }
});
