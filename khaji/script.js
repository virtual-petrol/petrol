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

// Enable offline persistence (optional)
db.enablePersistence().catch(err => console.log("Persistence error:", err));

// ================= REGISTER =================
document.getElementById("registerBtn").addEventListener("click", async () => {
  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  // Validation
  if (!username || !email || !password) {
    document.getElementById("error").innerText = "❌ All fields are required!";
    return;
  }

  if (password.length < 6) {
    document.getElementById("error").innerText = "❌ Password must be at least 6 characters!";
    return;
  }

  try {
    console.log("📝 Creating user account...");
    
    // Create user in Firebase Auth
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    console.log("✅ User created in Auth:", user.uid);
    
    // Save user data to Firestore
    await db.collection("users").doc(user.uid).set({
      username: username,
      email: email,
      isOnline: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      bio: "Hey there! I'm using Khaji Chat",
      status: "online"
    });
    
    console.log("✅ User saved to Firestore!");
    
    // Redirect to chat
    window.location.href = "chat.html";
    
  } catch (error) {
    console.error("❌ Registration error:", error);
    
    // User-friendly error messages
    if (error.code === 'auth/email-already-in-use') {
      document.getElementById("error").innerText = "❌ Email already in use!";
    } else if (error.code === 'auth/invalid-email') {
      document.getElementById("error").innerText = "❌ Invalid email!";
    } else if (error.code === 'auth/weak-password') {
      document.getElementById("error").innerText = "❌ Password too weak!";
    } else {
      document.getElementById("error").innerText = "❌ " + error.message;
    }
  }
});

// ================= LOGIN =================
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    document.getElementById("error").innerText = "❌ Email and password required!";
    return;
  }

  try {
    console.log("📝 Logging in...");
    
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    console.log("✅ Login successful:", user.email);
    
    // Update online status
    await db.collection("users").doc(user.uid).update({
      isOnline: true,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Redirect to chat
    window.location.href = "chat.html";
    
  } catch (error) {
    console.error("❌ Login error:", error);
    
    if (error.code === 'auth/user-not-found') {
      document.getElementById("error").innerText = "❌ User not found!";
    } else if (error.code === 'auth/wrong-password') {
      document.getElementById("error").innerText = "❌ Wrong password!";
    } else {
      document.getElementById("error").innerText = "❌ " + error.message;
    }
  }
});
