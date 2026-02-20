import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const usernameGroup = document.getElementById('username-group');
const mainBtn = document.getElementById('main-btn');
const btnText = mainBtn.querySelector('.btn-text');
const messageArea = document.getElementById('message-area');

let isLoginMode = true;

// --- Core Functions ---

// Toggle between Login and Register UI
window.switchTab = function(mode) {
  isLoginMode = (mode === 'login');
  
  // Update Tab Styles
  document.getElementById('login-tab').classList.toggle('active', isLoginMode);
  document.getElementById('register-tab').classList.toggle('active', !isLoginMode);
  
  // Show/Hide Username field
  usernameGroup.classList.toggle('hidden', isLoginMode);
  
  // Update Button Text
  btnText.textContent = isLoginMode ? 'Login' : 'Create Account';
  
  // Clear messages
  clearMessage();
}

// Handle Auth Logic
window.handleAuth = async function() {
  const email = emailInput.value;
  const password = passwordInput.value;
  const username = usernameInput.value;

  // Basic Validation
  if (!email || !password) {
    showMessage('Please fill in all fields.', 'error');
    return;
  }

  if (!isLoginMode && !username) {
    showMessage('Please choose a username.', 'error');
    return;
  }

  setLoading(true);

  try {
    if (isLoginMode) {
      // --- LOGIN ---
      await signInWithEmailAndPassword(auth, email, password);
      showMessage('Success! Redirecting...', 'success');
      window.location.href = "chat.html";
    } else {
      // --- REGISTER ---
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save to Firestore
      await setDoc(doc(db, "users", userCred.user.uid), {
        username: username,
        email: email,
        createdAt: new Date()
      });
      
      showMessage('Account created! Redirecting...', 'success');
      window.location.href = "chat.html";
    }
  } catch (error) {
    console.error(error);
    setLoading(false);
    handleFirebaseError(error);
  }
}

// Toggle Password Visibility
window.togglePassword = function() {
  const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
  passwordInput.setAttribute('type', type);
  document.querySelector('.toggle-password').textContent = type === 'password' ? 'visibility_off' : 'visibility';
}

// --- Helpers ---

function setLoading(state) {
  mainBtn.disabled = state;
  mainBtn.classList.toggle('loading', state);
}

function showMessage(msg, type) {
  messageArea.textContent = msg;
  messageArea.className = `message-area ${type}-msg`;
}

function clearMessage() {
  messageArea.textContent = '';
  messageArea.className = 'message-area';
}

function handleFirebaseError(error) {
  let msg = "An error occurred.";
  if (error.code === 'auth/email-already-in-use') msg = "Email already in use.";
  else if (error.code === 'auth/invalid-email') msg = "Invalid email format.";
  else if (error.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
  else if (error.code === 'auth/user-not-found') msg = "No account found with this email.";
  else if (error.code === 'auth/wrong-password') msg = "Incorrect password.";
  
  showMessage(msg, 'error');
}
