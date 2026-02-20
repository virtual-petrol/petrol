// ================= DEBUG FUNCTION =================
async function debugFirestore() {
  console.log("=== DEBUG START ===");
  console.log("Current User:", currentUser?.uid, currentUser?.email);
  
  try {
    // Check if users collection exists and has data
    const snapshot = await db.collection("users").get();
    console.log("Total users in database:", snapshot.size);
    
    snapshot.forEach(doc => {
      console.log("User in DB:", doc.id, doc.data());
    });
    
    if (snapshot.empty) {
      console.log("❌ No users found in database!");
    } else {
      console.log("✅ Users found in database!");
    }
  } catch (error) {
    console.error("❌ Error reading users:", error);
    console.log("Error code:", error.code);
    console.log("Error message:", error.message);
  }
  
  console.log("=== DEBUG END ===");
}

// Auth check ma debug call gara
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    console.log("Logged in as:", user.email);
    
    // Update user online status
    updateUserOnlineStatus(true);
    
    // DEBUG: Check database
    setTimeout(debugFirestore, 2000);
    
    // Load all users
    loadAllUsers();
  }
});

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
let currentChatUserData = null;
let unsubscribeMessages = null;
let unsubscribeUsers = null;

// ================= AUTH CHECK =================
auth.onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "index.html";
  } else {
    currentUser = user;
    console.log("Logged in as:", user.email);
    
    // Update user online status
    updateUserOnlineStatus(true);
    
    // Load all users
    loadAllUsers();
  }
});

// ================= UPDATE USER ONLINE STATUS =================
function updateUserOnlineStatus(isOnline) {
  if (currentUser) {
    db.collection("users").doc(currentUser.uid).update({
      isOnline: isOnline,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(error => {
      console.log("Status update error:", error);
    });
  }
}

// ================= LOAD ALL USERS =================
function loadAllUsers() {
  if (unsubscribeUsers) {
    unsubscribeUsers();
  }
  
  unsubscribeUsers = db.collection("users")
    .orderBy("lastSeen", "desc")
    .onSnapshot(snapshot => {
      const userList = document.getElementById("userList");
      userList.innerHTML = "";
      
      let hasUsers = false;
      
      snapshot.forEach(doc => {
        if (doc.id !== currentUser.uid) {
          hasUsers = true;
          const data = doc.data();
          createUserButton(doc.id, data);
        }
      });
      
      if (!hasUsers) {
        userList.innerHTML = "<p style='padding:20px; text-align:center; color:#666;'>No other users found</p>";
      }
    }, error => {
      console.error("Error loading users:", error);
    });
}

// ================= CREATE USER BUTTON =================
function createUserButton(userId, userData) {
  const userList = document.getElementById("userList");
  
  const userDiv = document.createElement("div");
  userDiv.className = "user-item";
  userDiv.id = `user-${userId}`;
  
  // Get initials for avatar
  const initials = userData.username 
    ? userData.username.substring(0, 2).toUpperCase() 
    : userData.email.substring(0, 2).toUpperCase();
  
  // Online status indicator
  const onlineStatus = userData.isOnline ? 
    '<span style="color:#22c55e; font-size:10px;">●</span>' : 
    '<span style="color:#94a3b8; font-size:10px;">●</span>';
  
  // Last seen time
  let lastSeenText = '';
  if (userData.lastSeen) {
    const lastSeen = userData.lastSeen.toDate ? 
      userData.lastSeen.toDate() : new Date(userData.lastSeen);
    const now = new Date();
    const diffMs = now - lastSeen;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      lastSeenText = 'just now';
    } else if (diffMins < 60) {
      lastSeenText = `${diffMins} min ago`;
    } else {
      lastSeenText = lastSeen.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
  }
  
  userDiv.innerHTML = `
    <div class="user-avatar">${initials}</div>
    <div style="flex:1;">
      <div style="font-weight:600; display:flex; align-items:center; gap:5px;">
        ${userData.username || 'User'} 
        ${onlineStatus}
      </div>
      <div style="font-size:12px; color:#666;">${userData.email}</div>
      ${userData.status ? `<div style="font-size:11px; color:#888;">${userData.status}</div>` : ''}
      ${!userData.isOnline && lastSeenText ? `<div style="font-size:10px; color:#999;">Last seen: ${lastSeenText}</div>` : ''}
    </div>
    <div style="display:flex; gap:5px;">
      <button class="video-call-btn" onclick="event.stopPropagation(); startVideoCall('${userId}', '${userData.username || 'User'}')" style="background:none; border:none; cursor:pointer;">
        <i class="fas fa-video" style="color:#6366f1;"></i>
      </button>
    </div>
  `;
  
  userDiv.onclick = (e) => {
    if (!e.target.closest('button')) {
      startChat(userId, userData);
    }
  };
  
  userList.appendChild(userDiv);
}

// ================= SEARCH USER =================
document.getElementById("searchBtn").addEventListener("click", searchUsers);

// Real-time search as you type
document.getElementById("searchEmail").addEventListener("input", (e) => {
  if (e.target.value.trim() === "") {
    loadAllUsers();
  } else {
    searchUsers();
  }
});

async function searchUsers() {
  const emailInput = document.getElementById("searchEmail");
  const email = emailInput.value.trim();

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
      userList.innerHTML = "<p style='padding:20px; text-align:center;'>No user found</p>";
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
  }
}

// ================= START CHAT =================
function startChat(userId, userData) {
  currentChatUser = userId;
  currentChatUserData = userData;
  
  // Highlight selected user
  document.querySelectorAll('.user-item').forEach(item => {
    item.classList.remove('active');
  });
  document.getElementById(`user-${userId}`)?.classList.add('active');
  
  // Update chat header
  const statusText = userData.isOnline ? '🟢 Online' : '⚫ Offline';
  document.getElementById("chatHeader").innerHTML = `
    <div style="display:flex; flex-direction:column;">
      <span><i class="fas fa-user"></i> ${userData.username || userData.email}</span>
      <span style="font-size:12px; color:#666;">${statusText}</span>
    </div>
  `;

  loadMessages();
  
  // Mark messages as read when opening chat
  markMessagesAsRead(userId);
}

// ================= MARK MESSAGES AS READ =================
async function markMessagesAsRead(otherUserId) {
  const chatId = [currentUser.uid, otherUserId].sort().join("_");
  
  try {
    const chatDoc = await db.collection("chats").doc(chatId).get();
    
    if (chatDoc.exists) {
      // Update unread count for current user to 0
      await db.collection("chats").doc(chatId).update({
        [`unreadCount.${currentUser.uid}`]: 0
      });
      
      // Mark individual messages as read
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
    }
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
}

// ================= LOAD MESSAGES =================
function loadMessages() {
  if (!currentChatUser) return;

  const chatId = [currentUser.uid, currentChatUser].sort().join("_");

  if (unsubscribeMessages) {
    unsubscribeMessages();
  }

  // Check if chat document exists, if not create it
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

  unsubscribeMessages = db.collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt")
    .onSnapshot(snapshot => {
      const chatBox = document.getElementById("chatBox");
      chatBox.innerHTML = "";

      snapshot.forEach(doc => {
        const msg = doc.data();
        
        // Update message status to delivered if it's for current user
        if (msg.receiverId === currentUser.uid && msg.status === "sent") {
          doc.ref.update({
            status: "delivered"
          });
        }
        
        const messageRow = document.createElement("div");
        messageRow.className = `message-row ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
        
        const messageBubble = document.createElement("div");
        messageBubble.className = "message-bubble";
        messageBubble.textContent = msg.text;
        
        // Add time and status
        if (msg.createdAt) {
          const time = msg.createdAt.toDate ? 
            msg.createdAt.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 
            new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
          
          const statusSpan = document.createElement("span");
          statusSpan.style.fontSize = "10px";
          statusSpan.style.marginLeft = "5px";
          statusSpan.style.opacity = "0.7";
          
          if (msg.senderId === currentUser.uid) {
            let statusIcon = '';
            if (msg.status === 'sent') statusIcon = '✓';
            else if (msg.status === 'delivered') statusIcon = '✓✓';
            else if (msg.status === 'read') statusIcon = '✓✓';
            statusSpan.textContent = ` ${time} ${statusIcon}`;
          } else {
            statusSpan.textContent = ` ${time}`;
          }
          
          messageBubble.appendChild(statusSpan);
        }
        
        messageRow.appendChild(messageBubble);
        chatBox.appendChild(messageRow);
      });

      // Auto scroll bottom
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
    alert("Select a user first");
    return;
  }

  const chatId = [currentUser.uid, currentChatUser].sort().join("_");

  try {
    // Add message to messages subcollection
    const messageRef = await db.collection("chats")
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

    // Update chat document
    await db.collection("chats").doc(chatId).update({
      lastMessage: text,
      lastMessageTime: firebase.firestore.FieldValue.serverTimestamp(),
      [`unreadCount.${currentChatUser}`]: firebase.firestore.FieldValue.increment(1)
    });

    input.value = "";

  } catch (error) {
    console.error("Send error:", error);
    alert("Failed to send message");
  }
}

// ================= VIDEO CALL FUNCTIONS =================
let localStream = null;
let peerConnection = null;

async function startVideoCall(userId, username) {
  if (!confirm(`Start video call with ${username}?`)) return;
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    
    const overlay = document.getElementById('videoOverlay');
    overlay.style.display = 'flex';
    
    const localVideo = document.getElementById('localVideo');
    localVideo.srcObject = localStream;
    
    alert('Video call started! (Note: Full WebRTC implementation requires a signaling server)');
    
  } catch (error) {
    console.error('Error starting video call:', error);
    alert('Could not access camera/microphone. Please check permissions.');
  }
}

window.endCall = function() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  
  document.getElementById('videoOverlay').style.display = 'none';
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
};

// ================= LOGOUT =================
document.getElementById("logoutBtn").addEventListener("click", () => {
  // Update online status to false
  updateUserOnlineStatus(false);
  
  // Clean up listeners
  if (unsubscribeMessages) unsubscribeMessages();
  if (unsubscribeUsers) unsubscribeUsers();
  
  auth.signOut();
});

// Handle browser close/tab close
window.addEventListener("beforeunload", () => {
  updateUserOnlineStatus(false);
});
