import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 YOUR CONFIG
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

window.register = async function () {
  const username = document.getElementById("username").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCred.user;

    await setDoc(doc(db, "users", user.uid), {
      username,
      email
    });

    window.location.href = "chat.html";
  } catch (err) {
    document.getElementById("auth-error").innerText = err.message;
  }
};

window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "chat.html";
  } catch (err) {
    document.getElementById("auth-error").innerText = err.message;
  }
};
