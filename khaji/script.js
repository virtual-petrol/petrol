import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
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

// Set persistence to LOCAL
setPersistence(auth, browserLocalPersistence);

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
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const username = usernameInput.value.trim();

  // Basic Validation
  if (!email || !password) {
    showMessage('Please fill in all fields.', 'error');
    return;
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showMessage('Please enter a valid email address.', 'error');
    return;
  }

  if (!isLoginMode && !username) {
    showMessage('Please choose a username.', 'error');
    return;
  }

  if (!isLoginMode && password.length < 6) {
    showMessage('Password must be at least 6 characters.', 'error');
    return;
  }

  setLoading(true);

  try {
    if (isLoginMode) {
      // --- LOGIN ---
      await signInWithEmailAndPassword(auth, email, password);
      showMessage('Login successful! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = "chat.html";
      }, 1000);
    } else {
      // --- REGISTER ---
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      
      // Save to Firestore
      await setDoc(doc(db, "users", userCred.user.uid), {
        username: username,
        email: email,
        createdAt: serverTimestamp(),
        isOnline: true,
        lastSeen: serverTimestamp()
      });
      
      showMessage('Account created successfully! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = "chat.html";
      }, 1000);
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
  const toggleIcon = document.querySelector('.toggle-password');
  toggleIcon.textContent = type === 'password' ? 'visibility_off' : 'visibility';
}

// --- Helpers ---

function setLoading(state) {
  mainBtn.disabled = state;
  mainBtn.classList.toggle('loading', state);
  btnText.textContent = state ? (isLoginMode ? 'Logging in...' : 'Creating account...') : (isLoginMode ? 'Login' : 'Create Account');
}

function showMessage(msg, type) {
  messageArea.textContent = msg;
  messageArea.className = `message-area show ${type}-msg`;
}

function clearMessage() {
  messageArea.textContent = '';
  messageArea.className = 'message-area';
}

function handleFirebaseError(error) {
  let msg = "An error occurred. Please try again.";
  
  switch(error.code) {
    case 'auth/email-already-in-use':
      msg = "This email is already registered. Please login instead.";
      break;
    case 'auth/invalid-email':
      msg = "Please enter a valid email address.";
      break;
    case 'auth/weak-password':
      msg = "Password should be at least 6 characters long.";
      break;
    case 'auth/user-not-found':
      msg = "No account found with this email. Please register first.";
      break;
    case 'auth/wrong-password':
      msg = "Incorrect password. Please try again.";
      break;
    case 'auth/too-many-requests':
      msg = "Too many failed attempts. Please try again later.";
      break;
    case 'auth/network-request-failed':
      msg = "Network error. Please check your internet connection.";
      break;
    default:
      msg = error.message;
  }
  
  showMessage(msg, 'error');
}

// Enter key handler
document.getElementById('auth-form').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAuth();
  }
});
