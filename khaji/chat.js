import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { 
  getAuth, 
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
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
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Global variables
let currentUser = null;
let selectedUser = null;
let unsubChat = null;
let unsubUsers = null;
let localStream = null;
let currentCall = null;
let peer = null;
let incomingCall = null;

// DOM Elements
const userListEl = document.getElementById('user-list');
const messagesContainer = document.getElementById('messages-container');
const chatHeader = document.getElementById('chat-header');
const messageInput = document.getElementById('message-input');
const sendBtn = document.querySelector('.send-btn');
const videoBtn = document.getElementById('video-btn');
const videoGrid = document.getElementById('video-grid');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const callModal = document.getElementById('call-modal');
const callerNameEl = document.getElementById('caller-name');

// Initialize PeerJS for video calls
function initPeer() {
  peer = new Peer({
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: {
      'iceServers': [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ]
    }
  });

  peer.on('open', (id) => {
    console.log('PeerJS ID:', id);
    // Update user's peer ID in Firestore
    if (currentUser) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        peerId: id
      });
    }
  });

  peer.on('call', (call) => {
    incomingCall = call;
    // Get caller info
    getDoc(doc(db, 'users', call.metadata.userId)).then((doc) => {
      if (doc.exists()) {
        callerNameEl.textContent = `${doc.data().username} is calling...`;
        callModal.classList.remove('hidden');
      }
    });
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    alert('Video call error: ' + err.type);
  });
}

// Check authentication state
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    console.log('Logged in as:', user.email);
    
    // Update user online status
    await updateDoc(doc(db, 'users', user.uid), {
      isOnline: true,
      lastSeen: serverTimestamp()
    });
    
    // Initialize PeerJS
    initPeer();
    
    // Load users
    loadUsers();
    
    // Enable input if user is selected
    if (selectedUser) {
      messageInput.disabled = false;
      sendBtn.disabled = false;
    }
  } else {
    // Not logged in, redirect to login
    window.location.href = 'index.html';
  }
});

// Load all users except current user
function loadUsers() {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('uid', '!=', currentUser?.uid));
  
  unsubUsers = onSnapshot(q, (snapshot) => {
    const users = [];
    snapshot.forEach((doc) => {
      if (doc.id !== currentUser?.uid) {
        users.push({ id: doc.id, ...doc.data() });
      }
    });
    
    renderUserList(users);
  });
}

// Render user list
function renderUserList(users) {
  if (users.length === 0) {
    userListEl.innerHTML = `
      <div class="empty-state">
        <span class="material-icons">people_outline</span>
        <p>No other users found</p>
      </div>
    `;
    return;
  }
  
  userListEl.innerHTML = users.map(user => `
    <div class="user-item ${selectedUser?.id === user.id ? 'active' : ''}" onclick="selectUser('${user.id}', '${user.username}', '${user.email}')">
      <div class="user-avatar">
        ${user.username?.charAt(0).toUpperCase() || '?'}
        ${user.isOnline ? '<span class="online-indicator"></span>' : ''}
      </div>
      <div class="user-info">
        <div class="user-name">${user.username || 'Unknown'}</div>
        <div class="last-message">${user.email}</div>
      </div>
    </div>
  `).join('');
}

// Select a user to chat with
window.selectUser = async function(userId, username, email) {
  // Remove active class from all users
  document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
  
  // Add active class to selected user
  event.currentTarget.classList.add('active');
  
  selectedUser = {
    id: userId,
    username: username,
    email: email
  };
  
  // Update chat header
  chatHeader.innerHTML = `
    <div class="user-avatar">${username.charAt(0).toUpperCase()}</div>
    <div class="chat-header-info">
      <h3>${username}</h3>
      <p>${email}</p>
    </div>
  `;
  
  // Enable input
  messageInput.disabled = false;
  sendBtn.disabled = false;
  messageInput.focus();
  
  // Load messages
  loadMessages(userId);
  
  // Enable video button
  videoBtn.classList.remove('hidden');
};

// Load messages for selected user
function loadMessages(otherUserId) {
  if (unsubChat) {
    unsubChat();
  }
  
  const messagesRef = collection(db, 'messages');
  const q = query(
    messagesRef,
    where('participants', 'array-contains', currentUser.uid),
    orderBy('timestamp', 'asc')
  );
  
  unsubChat = onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      const msg = doc.data();
      // Filter messages between current user and selected user
      if ((msg.senderId === currentUser.uid && msg.receiverId === otherUserId) ||
          (msg.senderId === otherUserId && msg.receiverId === currentUser.uid)) {
        messages.push({ id: doc.id, ...msg });
      }
    });
    
    renderMessages(messages);
  });
}

// Render messages
function renderMessages(messages) {
  if (messages.length === 0) {
    messagesContainer.innerHTML = `
      <div class="empty-state">
        <span class="material-icons">chat_bubble_outline</span>
        <p>No messages yet. Start a conversation!</p>
      </div>
    `;
    return;
  }
  
  messagesContainer.innerHTML = messages.map(msg => {
    const isSent = msg.senderId === currentUser.uid;
    const time = msg.timestamp?.toDate() || new Date();
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `
      <div class="message-row ${isSent ? 'sent' : 'received'}">
        <div class="message-bubble">
          ${msg.text}
          <div class="message-time">${timeStr}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send message
window.sendMessage = async function() {
  const text = messageInput.value.trim();
  
  if (!text || !selectedUser) {
    return;
  }
  
  try {
    const messagesRef = collection(db, 'messages');
    await addDoc(messagesRef, {
      text: text,
      senderId: currentUser.uid,
      receiverId: selectedUser.id,
      participants: [currentUser.uid, selectedUser.id],
      timestamp: serverTimestamp(),
      read: false
    });
    
    messageInput.value = '';
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
};

// Handle enter key
window.handleEnter = function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
};

// Search users
window.searchUsers = function() {
  const searchTerm = document.getElementById('search-input').value.toLowerCase();
  
  // This will be handled by the Firestore query
  // For now, we'll just filter the rendered list
  const userItems = document.querySelectorAll('.user-item');
  userItems.forEach(item => {
    const email = item.querySelector('.last-message')?.textContent.toLowerCase() || '';
    const username = item.querySelector('.user-name')?.textContent.toLowerCase() || '';
    
    if (email.includes(searchTerm) || username.includes(searchTerm)) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
    }
  });
};

// Logout
window.logout = async function() {
  try {
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        isOnline: false,
        lastSeen: serverTimestamp()
      });
    }
    
    await signOut(auth);
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
};

// Video Call Functions
window.startVideoCall = async function() {
  if (!selectedUser) {
    alert('Please select a user to call');
    return;
  }
  
  try {
    // Get user's media stream
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    
    // Get selected user's peer ID
    const userDoc = await getDoc(doc(db, 'users', selectedUser.id));
    const userData = userDoc.data();
    
    if (!userData.peerId) {
      alert('User is not available for video calls');
      localStream.getTracks().forEach(track => track.stop());
      return;
    }
    
    // Start call
    const call = peer.call(userData.peerId, localStream, {
      metadata: {
        userId: currentUser.uid,
        username: currentUser.displayName || 'User'
      }
    });
    
    currentCall = call;
    
    call.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
      videoGrid.classList.remove('hidden');
    });
    
    call.on('close', () => {
      endCall();
    });
    
    call.on('error', (err) => {
      console.error('Call error:', err);
      endCall();
    });
    
  } catch (error) {
    console.error('Error starting call:', error);
    alert('Failed to start video call. Please check your camera/microphone permissions.');
  }
};

window.answerCall = async function() {
  callModal.classList.add('hidden');
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
    
    incomingCall.answer(localStream);
    
    currentCall = incomingCall;
    
    incomingCall.on('stream', (remoteStream) => {
      remoteVideo.srcObject = remoteStream;
      videoGrid.classList.remove('hidden');
    });
    
    incomingCall.on('close', () => {
      endCall();
    });
    
  } catch (error) {
    console.error('Error answering call:', error);
    alert('Failed to answer call. Please check your camera/microphone permissions.');
  }
};

window.rejectCall = function() {
  callModal.classList.add('hidden');
  if (incomingCall) {
    incomingCall.close();
  }
};

window.endCall = function() {
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  
  videoGrid.classList.add('hidden');
  
  // Clear video elements
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
};

window.toggleVideoMinimize = function() {
  videoGrid.classList.toggle('minimized');
};

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (currentUser) {
    updateDoc(doc(db, 'users', currentUser.uid), {
      isOnline: false,
      lastSeen: serverTimestamp()
    });
  }
  
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  
  if (currentCall) {
    currentCall.close();
  }
  
  if (peer) {
    peer.destroy();
  }
});
