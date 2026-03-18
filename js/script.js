// ============================================
// Khaji Chat Application
// Main JavaScript File
// ============================================

// Global Variables
let auth, db, storage;
let me = null;
let currentChat = { type: null, id: null, data: null };
let currentTab = 'chats';
let deleteTarget = null;
let typingTimer = null;
let unreadCounts = {};
let groupUnreadCounts = {};
let isInitialLoad = true;

const appStartTime = Date.now();
const notifiedMessages = new Set();

// WebRTC Variables
let pc = null;
let myStream = null;
let callId = null;
let callType = null;
const servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};
let currentFacingMode = 'user';
let callStartTime = null;
let callStatusListener = null;
let candidateListenerCaller = null;
let candidateListenerCallee = null;
let answerListener = null;
let msgListeners = {};
let groupMsgListeners = {};

// Queue for ICE candidates
let iceCandidatesQueue = [];

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    try {
        const firebaseConfig = {
            apiKey: "AIzaSyBtPQ_HcTZtqlPuQ11awTUOIiPjvpMNWlU",
            authDomain: "khaji-23a99.firebaseapp.com",
            databaseURL: "https://khaji-23a99-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "khaji-23a99",
            storageBucket: "khaji-23a99.firebasestorage.app",
            messagingSenderId: "84794766200",
            appId: "1:84794766200:web:207a50412961d45275ce8d"
        };

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        auth = firebase.auth();
        db = firebase.database();
        storage = firebase.storage();

        try {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } catch (e) {
            console.warn("Persistence set", e);
        }

        auth.onAuthStateChanged(handleAuthState);
    } catch (error) {
        console.error("Init Error:", error);
        showToast("Failed to initialize app.", "error");
    }
}

// ============================================
// Utility Functions
// ============================================

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function playSound(type) {
    try {
        let audio;
        if (type === 'message') audio = document.getElementById('msgSound');
        else if (type === 'sent') audio = document.getElementById('sentSound');
        else if (type === 'ring') audio = document.getElementById('ringSound');

        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log("Audio fail:", e));
        }
    } catch (e) {
        console.log(e);
    }
}

function stopSound() {
    try {
        const audio = document.getElementById('ringSound');
        audio.pause();
        audio.currentTime = 0;
    } catch (e) { }
}

// Modal Functions
function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

// ============================================
// Authentication Functions
// ============================================

async function handleAuthState(user) {
    if (user) {
        if (!user.emailVerified) {
            showVerifyScreen(user.email);
            return;
        }

        try {
            await db.ref('users/' + user.uid).update({
                online: true,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });

            const snap = await db.ref('users/' + user.uid).once('value');
            const dbUser = snap.val();

            if (!dbUser) {
                await db.ref('users/' + user.uid).set({
                    name: user.displayName || "User",
                    email: user.email,
                    online: true,
                    bio: '',
                    status: 'Hey there!',
                    verified: true
                });
                me = { uid: user.uid, name: user.displayName || "User", email: user.email };
            } else {
                me = { uid: user.uid, name: dbUser.name || user.displayName || "User", email: user.email };
            }

            db.ref('users/' + me.uid + '/online').onDisconnect().set(false);
            db.ref('users/' + me.uid + '/lastSeen').onDisconnect().set(firebase.database.ServerValue.TIMESTAMP);

            if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                Notification.requestPermission();
            }

            showApp();
            listenCalls();
        } catch (error) {
            console.error("Auth error:", error);
            showToast("Error loading user data", 'error');
            document.getElementById('authSection').style.display = 'flex';
            document.getElementById('appSection').style.display = 'none';
        }
    } else {
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('appSection').style.display = 'none';
        me = null;
        currentChat = { type: null, id: null, data: null };
        backToLogin();
    }
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));

    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }
}

function showForgotPassword() {
    document.getElementById('authMainContainer').style.display = 'none';
    document.getElementById('verifyContainer').style.display = 'none';
    document.getElementById('forgotContainer').style.display = 'block';
}

function backToLogin() {
    document.getElementById('authMainContainer').style.display = 'block';
    document.getElementById('forgotContainer').style.display = 'none';
    document.getElementById('verifyContainer').style.display = 'none';
    switchAuthTab('login');
}

function showVerifyScreen(email) {
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('appSection').style.display = 'none';
    document.getElementById('authMainContainer').style.display = 'none';
    document.getElementById('forgotContainer').style.display = 'none';
    document.getElementById('verifyContainer').style.display = 'block';
    document.getElementById('verifyEmailLabel').innerText = email;
}

async function login() {
    const btn = document.getElementById('loginBtn');
    const originalText = btn.innerText;

    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPass').value;

        if (!email || !password) {
            showToast("Enter email and password", 'error');
            return;
        }

        btn.disabled = true;
        btn.innerText = "Logging in...";

        const userCred = await auth.signInWithEmailAndPassword(email, password);

        if (userCred.user && !userCred.user.emailVerified) {
            showToast("Verify email first.", 'error');
            await auth.signOut();
        } else {
            showToast("Login Successful!", 'success');
        }
    } catch (e) {
        let msg = e.message;
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') msg = "Incorrect password.";
        else if (e.code === 'auth/user-not-found') msg = "User not found.";
        else if (e.code === 'auth/invalid-email') msg = "Invalid email.";
        showToast(msg, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function register() {
    const btn = document.getElementById('regBtn');
    const originalText = btn.innerText;

    try {
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPass').value;

        if (!name) {
            showToast("Enter name", 'error');
            return;
        }

        if (password.length < 6) {
            showToast("Password min 6 chars", 'error');
            return;
        }

        btn.disabled = true;
        btn.innerText = "Creating...";

        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        await cred.user.sendEmailVerification();

        await db.ref('users/' + cred.user.uid).set({
            name: name,
            email: cred.user.email,
            online: false,
            bio: '',
            status: 'Hey there!',
            verified: false
        });

        showToast("Registered! Verify email.", 'success');
        showVerifyScreen(cred.user.email);
    } catch (e) {
        let msg = e.message;
        if (e.code === 'auth/email-already-in-use') msg = "Email already used.";
        showToast(msg, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function resetPassword() {
    const email = document.getElementById('forgotEmail').value;
    if (!email) {
        showToast("Enter email", 'error');
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        showToast("Reset link sent!", 'success');
        setTimeout(backToLogin, 2000);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function resendVerification() {
    try {
        if (auth.currentUser) {
            await auth.currentUser.sendEmailVerification();
            showToast("Verification sent!", 'success');
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function checkVerification() {
    try {
        if (auth.currentUser) {
            showToast("Checking...", 'info');
            await auth.currentUser.reload();

            if (auth.currentUser.emailVerified) {
                showToast("Verified! Loading...", "success");
            } else {
                showToast("Not verified yet.", 'info');
            }
        }
    } catch (e) {
        showToast("Error checking", 'error');
    }
}

async function logout() {
    try {
        closeModal('profileModal');

        if (me && me.uid) {
            await db.ref('users/' + me.uid).update({
                online: false,
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
        }

        await auth.signOut();
        showToast("Logged out", 'success');
    } catch (e) {
        showToast("Logout error", 'error');
    }
}

// ============================================
// App UI Functions
// ============================================

function showApp() {
    const authSec = document.getElementById('authSection');
    const appSec = document.getElementById('appSection');

    authSec.style.display = 'none';
    appSec.style.display = 'flex';

    document.getElementById('myName').innerText = me.name;
    document.getElementById('myAvatar').innerText = me.name.charAt(0).toUpperCase();

    setupInputListeners();
    loadProfile();
    loadTab('chats');
}

function setupInputListeners() {
    const msgInput = document.getElementById('msgInput');
    const msgBox = document.getElementById('msgBox');

    msgInput.addEventListener('focus', () => {
        setTimeout(() => {
            msgBox.scrollTop = msgBox.scrollHeight;
        }, 300);
    });

    window.addEventListener('resize', () => {
        if (document.activeElement === msgInput) {
            msgBox.scrollTop = msgBox.scrollHeight;
        }
    });
}

async function loadProfile() {
    try {
        const snap = await db.ref('users/' + me.uid).once('value');
        const d = snap.val();

        if (d) {
            document.getElementById('editName').value = d.name || '';
            document.getElementById('editBio').value = d.bio || '';
            document.getElementById('editStatus').value = d.status || '';
        }
    } catch (e) {
        console.error("Error loading profile", e);
    }
}

async function saveProfile() {
    try {
        const name = document.getElementById('editName').value;
        const bio = document.getElementById('editBio').value;
        const status = document.getElementById('editStatus').value;

        if (!name) {
            showToast("Name required", 'error');
            return;
        }

        await db.ref('users/' + me.uid).update({ name, bio, status });
        await auth.currentUser.updateProfile({ displayName: name });

        me.name = name;
        document.getElementById('myName').innerText = name;
        document.getElementById('myAvatar').innerText = name.charAt(0);

        closeModal('profileModal');
        showToast('Profile updated', 'success');
    } catch (e) {
        showToast('Update error', 'error');
    }
}

async function toggleStatus() {
    try {
        const online = document.getElementById('onlineCheck').checked;
        await db.ref('users/' + me.uid).update({
            online,
            lastSeen: online ? null : firebase.database.ServerValue.TIMESTAMP
        });
    } catch (e) {
        console.error(e);
    }
}

function loadTab(tab) {
    currentTab = tab;

    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));

    const tabId = 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1);
    const tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.classList.add('active');

    if (tab === 'chats') loadChats();
    else if (tab === 'friends') loadFriends();
    else if (tab === 'groups') loadGroups();
    else loadSearch();
}

// ============================================
// Chat Functions
// ============================================

async function loadChats() {
    try {
        const privateChats = await loadRecentPrivateChats();
        const groups = await loadUserGroups();

        const allChats = [...privateChats, ...groups].sort((a, b) =>
            (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
        );

        renderChatList(allChats);
    } catch (e) {
        console.error("Error loading chats:", e);
    }
}

async function loadRecentPrivateChats() {
    const chats = [];
    const snap = await db.ref('friendships').once('value');
    const data = snap.val() || {};

    for (let key in data) {
        if (data[key] && data[key][me.uid] && data[key][me.uid].status === 'accepted') {
            const otherId = Object.keys(data[key]).find(x => x !== me.uid);

            if (otherId) {
                const userSnap = await db.ref('users/' + otherId).once('value');
                const user = userSnap.val();

                if (user) {
                    const chatId = [me.uid, otherId].sort().join('_');
                    const lastMsgSnap = await db.ref('messages/' + chatId)
                        .orderByKey()
                        .limitToLast(1)
                        .once('value');

                    const lastMsg = lastMsgSnap.val();
                    const lastMsgTime = lastMsg ? Object.values(lastMsg)[0].timestamp : 0;

                    chats.push({
                        type: 'private',
                        id: otherId,
                        chatId: chatId,
                        name: user.name,
                        avatar: user.name.charAt(0),
                        lastMessageTime: lastMsgTime,
                        unread: unreadCounts[otherId] || 0
                    });
                }
            }
        }
    }

    return chats;
}

async function loadUserGroups() {
    const groups = [];
    const snap = await db.ref('userGroups/' + me.uid).once('value');
    const groupIds = snap.val() || {};

    for (let groupId in groupIds) {
        if (groupIds[groupId]) {
            const groupSnap = await db.ref('groups/' + groupId).once('value');
            const group = groupSnap.val();

            if (group) {
                const lastMsgSnap = await db.ref('groupMessages/' + groupId)
                    .orderByKey()
                    .limitToLast(1)
                    .once('value');

                const lastMsg = lastMsgSnap.val();
                const lastMsgTime = lastMsg ? Object.values(lastMsg)[0].timestamp : 0;

                groups.push({
                    type: 'group',
                    id: groupId,
                    name: group.name,
                    avatar: 'G',
                    memberCount: group.members ? Object.keys(group.members).length : 0,
                    lastMessageTime: lastMsgTime,
                    unread: groupUnreadCounts[groupId] || 0
                });
            }
        }
    }

    return groups;
}

function renderChatList(chats) {
    const cont = document.getElementById('sidebarContent');

    if (chats.length === 0) {
        cont.innerHTML = `<div class="empty-state">No chats yet</div>`;
        return;
    }

    let html = '';

    chats.forEach(chat => {
        const unreadClass = chat.unread > 0 ? 'has-unread' : '';
        const unreadBadge = chat.unread > 0 ? `<div class="unread-badge">${chat.unread}</div>` : '';
        const typeIcon = chat.type === 'group' ? '👥 ' : '';

        html += `<div class="user-item ${unreadClass}" onclick="openChat('${chat.type}', '${chat.id}')">
            <div class="avatar ${chat.type === 'group' ? 'group-avatar' : ''}">${chat.avatar}</div>
            <div>
                <h4>${typeIcon}${chat.name}</h4>
                ${chat.type === 'group' ? `<p class="member-count">${chat.memberCount} members</p>` : ''}
            </div>
            ${unreadBadge}
        </div>`;
    });

    cont.innerHTML = html;
}

async function loadFriends() {
    try {
        const snap = await db.ref('friendships').once('value');
        const data = snap.val() || {};
        const ids = [];

        Object.keys(data).forEach(k => {
            const f = data[k];
            if (f && f[me.uid] && f[me.uid].status === 'accepted') {
                const otherId = Object.keys(f).find(x => x !== me.uid);
                if (otherId) ids.push(otherId);
            }
        });

        const friends = [];

        for (let uid of ids) {
            const uSnap = await db.ref('users/' + uid).once('value');
            const u = uSnap.val();
            if (u) {
                friends.push({ uid, ...u });
            }
        }

        renderFriendsList(friends);
    } catch (e) {
        console.error("Error loading friends:", e);
    }
}

function renderFriendsList(friends) {
    const cont = document.getElementById('sidebarContent');

    if (friends.length === 0) {
        cont.innerHTML = `<div class="empty-state">No friends yet</div>`;
        return;
    }

    let html = '';

    friends.forEach(u => {
        const status = u.online ? '' : 'offline';

        html += `<div class="user-item" onclick="openChat('private', '${u.uid}')">
            <div class="avatar">${(u.name || 'U').charAt(0)}</div>
            <div>
                <h4>${u.name}</h4>
                <p style="font-size:11px;color:#888">${u.status || ''}</p>
            </div>
            <div class="user-status ${status}"></div>
        </div>`;
    });

    cont.innerHTML = html;
}

async function loadGroups() {
    try {
        const snap = await db.ref('userGroups/' + me.uid).once('value');
        const groupIds = snap.val() || {};
        const groups = [];

        for (let groupId in groupIds) {
            if (groupIds[groupId]) {
                const groupSnap = await db.ref('groups/' + groupId).once('value');
                const group = groupSnap.val();

                if (group) {
                    groups.push({ id: groupId, ...group });
                }
            }
        }

        renderGroupsList(groups);
    } catch (e) {
        console.error("Error loading groups:", e);
    }
}

function renderGroupsList(groups) {
    const cont = document.getElementById('sidebarContent');

    let html = `<button class="create-group-btn" onclick="showCreateGroupModal()">+ Create New Group</button>`;

    if (groups.length === 0) {
        html += `<div class="empty-state">No groups yet</div>`;
    } else {
        groups.forEach(group => {
            const memberCount = group.members ? Object.keys(group.members).length : 0;

            html += `<div class="group-item" onclick="openChat('group', '${group.id}')">
                <div class="avatar group-avatar">G</div>
                <div>
                    <h4>${group.name}</h4>
                    <p class="member-count">${memberCount} members</p>
                </div>
            </div>`;
        });
    }

    cont.innerHTML = html;
}

async function loadSearch() {
    try {
        const snap = await db.ref('users').once('value');
        const users = snap.val() || {};

        const fSnap = await db.ref('friendships').once('value');
        const fs = fSnap.val() || {};
        const friendIds = [];

        Object.keys(fs).forEach(k => {
            if (fs[k] && fs[k][me.uid]) {
                const otherId = Object.keys(fs[k]).find(x => x !== me.uid);
                if (otherId) friendIds.push(otherId);
            }
        });

        const rSnap = await db.ref('friendRequests').orderByChild('from').equalTo(me.uid).once('value');
        const rs = rSnap.val() || {};
        const pendingIds = [];

        Object.keys(rs).forEach(k => pendingIds.push(rs[k].to));

        const list = [];

        Object.keys(users).forEach(uid => {
            const u = users[uid];
            if (uid !== me.uid && !friendIds.includes(uid) && !pendingIds.includes(uid) && u.verified === true) {
                list.push({ uid, ...u });
            }
        });

        renderSearch(list);
    } catch (e) {
        console.error("Error loading search:", e);
    }
}

function renderSearch(list) {
    const cont = document.getElementById('sidebarContent');

    if (list.length === 0) {
        cont.innerHTML = `<div class="empty-state">No users found</div>`;
        return;
    }

    let html = '';

    list.forEach(u => {
        html += `<div class="user-item">
            <div class="avatar">${(u.name || 'U').charAt(0)}</div>
            <div>
                <h4>${u.name}</h4>
                <p style="font-size:11px;color:#888">${u.email}</p>
            </div>
            <button class="action-btn-sm add-sm" onclick="addFriend('${u.uid}')">Add</button>
        </div>`;
    });

    cont.innerHTML = html;
}

async function addFriend(uid) {
    try {
        await db.ref('friendRequests').push({
            from: me.uid,
            to: uid,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        showToast('Friend request sent!', 'success');
        loadTab('search');
    } catch (e) {
        console.error("Error sending friend request:", e);
        showToast('Error sending request', 'error');
    }
}

// ============================================
// Group Functions
// ============================================

async function showCreateGroupModal() {
    try {
        const snap = await db.ref('friendships').once('value');
        const data = snap.val() || {};
        const friends = [];

        for (let key in data) {
            if (data[key] && data[key][me.uid] && data[key][me.uid].status === 'accepted') {
                const otherId = Object.keys(data[key]).find(x => x !== me.uid);

                if (otherId) {
                    const uSnap = await db.ref('users/' + otherId).once('value');
                    const u = uSnap.val();

                    if (u) {
                        friends.push({ uid: otherId, name: u.name });
                    }
                }
            }
        }

        let html = '';

        friends.forEach(friend => {
            html += `<div class="member-item">
                <input type="checkbox" class="member-checkbox" value="${friend.uid}" id="member-${friend.uid}">
                <label for="member-${friend.uid}">${friend.name}</label>
            </div>`;
        });

        document.getElementById('memberList').innerHTML = html;
        openModal('groupModal');
    } catch (e) {
        console.error("Error loading friends for group:", e);
        showToast("Error loading friends", "error");
    }
}

async function createGroup() {
    const groupName = document.getElementById('groupName').value.trim();

    if (!groupName) {
        showToast("Enter group name", 'error');
        return;
    }

    const checkboxes = document.querySelectorAll('#memberList .member-checkbox:checked');
    const members = [me.uid];

    checkboxes.forEach(cb => members.push(cb.value));

    if (members.length < 2) {
        showToast("Add at least one member", 'error');
        return;
    }

    try {
        const groupRef = db.ref('groups').push();
        const groupId = groupRef.key;

        const membersObj = {};
        members.forEach(uid => { membersObj[uid] = true; });

        await groupRef.set({
            name: groupName,
            createdBy: me.uid,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            members: membersObj
        });

        const updates = {};

        members.forEach(uid => {
            updates[`userGroups/${uid}/${groupId}`] = true;
        });

        await db.ref().update(updates);

        closeModal('groupModal');
        showToast("Group created!", "success");
        loadTab('groups');
    } catch (e) {
        console.error("Error creating group:", e);
        showToast("Error creating group", "error");
    }
}

async function leaveGroup() {
    if (!currentChat || currentChat.type !== 'group') return;

    try {
        await db.ref('userGroups/' + me.uid + '/' + currentChat.id).remove();
        await db.ref('groups/' + currentChat.id + '/members/' + me.uid).remove();

        closeModal('groupInfoModal');
        goBack();
        showToast("Left group", "success");
        loadTab('groups');
    } catch (e) {
        console.error("Error leaving group:", e);
        showToast("Error leaving group", "error");
    }
}

// ============================================
// Chat Opening & Messaging
// ============================================

async function openChat(type, id) {
    try {
        if (type === 'private') {
            const uSnap = await db.ref('users/' + id).once('value');
            const user = uSnap.val();

            currentChat = {
                type: 'private',
                id: id,
                data: user,
                chatId: [me.uid, id].sort().join('_')
            };

            unreadCounts[id] = 0;

            document.getElementById('chatAvatar').innerText = (user.name || 'U').charAt(0);
            document.getElementById('chatName').innerText = user.name;
            document.getElementById('chatAvatar').classList.remove('group-avatar');

            // Enable call buttons for private chats
            document.getElementById('videoCallBtn').disabled = false;
            document.getElementById('audioCallBtn').disabled = false;

            await db.ref('chats/' + currentChat.chatId).set({ [me.uid]: true, [id]: true });

            loadPrivateMessages();
            listenTyping();
        } else {
            const groupSnap = await db.ref('groups/' + id).once('value');
            const group = groupSnap.val();

            currentChat = {
                type: 'group',
                id: id,
                data: group,
                chatId: id
            };

            groupUnreadCounts[id] = 0;

            document.getElementById('chatAvatar').innerText = 'G';
            document.getElementById('chatName').innerText = group.name;
            document.getElementById('chatAvatar').classList.add('group-avatar');

            // Disable call buttons for groups
            document.getElementById('videoCallBtn').disabled = true;
            document.getElementById('audioCallBtn').disabled = true;

            loadGroupMessages();
        }

        document.getElementById('msgInput').disabled = false;
        document.getElementById('sendBtn').disabled = false;

        if (window.innerWidth <= 768) {
            document.getElementById('appContainer').classList.add('chat-open');
        }

        document.getElementById('msgBox').innerHTML = '';

        if (currentTab === 'chats') loadChats();
    } catch (e) {
        console.error("Error opening chat:", e);
        showToast('Error opening chat', 'error');
    }
}

function loadPrivateMessages() {
    if (!currentChat || currentChat.type !== 'private') return;

    db.ref('messages/' + currentChat.chatId).off();

    db.ref('messages/' + currentChat.chatId)
        .orderByChild('timestamp')
        .on('child_added', async snap => {
            const msg = snap.val();
            const msgId = snap.key;

            if (msg && msg.sender !== me.uid && msg.status !== 'seen') {
                await db.ref('messages/' + currentChat.chatId + '/' + msgId).update({ status: 'seen' });
            }

            renderMessage(msgId, msg);
        });

    db.ref('messages/' + currentChat.chatId).on('child_changed', snap => {
        const msg = snap.val();
        const msgId = snap.key;
        const el = document.getElementById('msg-' + msgId);

        if (el && msg) {
            if (msg.deleted) {
                const contentEl = el.querySelector('.message-content');
                if (contentEl) contentEl.innerHTML = "Message deleted";
                el.classList.add('deleted');
            } else if (msg.status === 'seen' && msg.sender === me.uid) {
                const statusEl = el.querySelector('.status-tick');
                if (statusEl) {
                    statusEl.innerHTML = '✓✓';
                    statusEl.classList.add('seen');
                }
            }
        }
    });
}

function loadGroupMessages() {
    if (!currentChat || currentChat.type !== 'group') return;

    db.ref('groupMessages/' + currentChat.id).off();

    db.ref('groupMessages/' + currentChat.id)
        .orderByChild('timestamp')
        .on('child_added', snap => {
            const msg = snap.val();
            const msgId = snap.key;
            renderGroupMessage(msgId, msg);
        });
}

function renderMessage(id, msg) {
    if (!msg) return;

    const box = document.getElementById('msgBox');
    const sent = msg.sender === me.uid;

    const div = document.createElement('div');
    div.className = `message ${sent ? 'sent' : 'received'}`;
    div.id = 'msg-' + id;

    let content = '';

    if (msg.deleted) {
        content = `<div class="message-content" style="background:#eee; color:#888;">Message deleted</div>`;
        div.classList.add('deleted');
    } else if (msg.image) {
        content = `<img src="${msg.image}" class="message-img" onclick="showImage('${msg.image}')"><div class="message-content">${msg.text || ''}</div>`;
    } else {
        content = `<div class="message-content">${msg.text || ''}</div>`;
    }

    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    let statusHtml = '';
    if (sent) {
        if (msg.status === 'seen') statusHtml = '<span class="status-tick seen">✓✓</span>';
        else statusHtml = '<span class="status-tick">✓</span>';
    }

    div.innerHTML = `${content}<div class="message-time">${time} ${statusHtml} ${sent ? `<span class="msg-actions"><button class="del-btn" onclick="deleteMsg('${id}')">🗑️</button></span>` : ''}</div>`;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function renderGroupMessage(id, msg) {
    if (!msg) return;

    const box = document.getElementById('msgBox');
    const sent = msg.sender === me.uid;

    const div = document.createElement('div');
    div.className = `message ${sent ? 'sent' : 'received'}`;
    div.id = 'msg-' + id;

    let content = '';
    const senderName = msg.senderName || 'Unknown';

    if (msg.deleted) {
        content = `<div class="message-content" style="background:#eee; color:#888;">Message deleted</div>`;
        div.classList.add('deleted');
    } else if (msg.image) {
        content = `<img src="${msg.image}" class="message-img" onclick="showImage('${msg.image}')"><div class="message-content">${msg.text || ''}</div>`;
    } else {
        content = `<div class="message-content">${msg.text || ''}</div>`;
    }

    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    if (!sent) {
        div.innerHTML = `<div class="sender-name">${senderName}</div>${content}<div class="message-time">${time}</div>`;
    } else {
        div.innerHTML = `${content}<div class="message-time">${time} ${sent ? `<span class="msg-actions"><button class="del-btn" onclick="deleteMsg('${id}')">🗑️</button></span>` : ''}</div>`;
    }

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
    const text = document.getElementById('msgInput').value.trim();

    if (!text || !currentChat || !currentChat.chatId) return;

    const inputEl = document.getElementById('msgInput');

    try {
        clearTimeout(typingTimer);

        if (currentChat.type === 'private') {
            await db.ref('typing/' + currentChat.chatId + '/' + me.uid).remove();

            await db.ref('messages/' + currentChat.chatId).push({
                sender: me.uid,
                senderName: me.name,
                text,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                status: 'sent'
            });
        } else {
            await db.ref('groupMessages/' + currentChat.chatId).push({
                sender: me.uid,
                senderName: me.name,
                text,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }

        playSound('sent');
        inputEl.value = '';
        inputEl.focus();
    } catch (e) {
        showToast('Error sending message', 'error');
    }
}

function handleTyping() {
    if (!currentChat || currentChat.type !== 'private') return;

    db.ref('typing/' + currentChat.chatId + '/' + me.uid).set(true);

    clearTimeout(typingTimer);

    typingTimer = setTimeout(() => {
        db.ref('typing/' + currentChat.chatId + '/' + me.uid).remove();
    }, 2000);
}

function listenTyping() {
    if (!currentChat || currentChat.type !== 'private') return;

    db.ref('typing/' + currentChat.chatId).on('value', snap => {
        const data = snap.val();
        const div = document.getElementById('typingDiv');

        if (data && data[currentChat.id]) {
            div.style.display = 'block';
        } else {
            div.style.display = 'none';
        }
    });
}

async function handleImageUpload(e) {
    const file = e.target.files[0];

    if (!file || !currentChat) return;

    if (file.size > 5 * 1024 * 1024) {
        showToast('Image too large (max 5MB)', 'error');
        return;
    }

    try {
        showToast('Uploading image...', 'info');

        const path = `chat_images/${currentChat.chatId}/${Date.now()}_${file.name}`;
        const ref = storage.ref(path);

        await ref.put(file);
        const url = await ref.getDownloadURL();

        if (currentChat.type === 'private') {
            await db.ref('messages/' + currentChat.chatId).push({
                sender: me.uid,
                image: url,
                text: '',
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                status: 'sent'
            });
        } else {
            await db.ref('groupMessages/' + currentChat.chatId).push({
                sender: me.uid,
                senderName: me.name,
                image: url,
                text: '',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
        }

        playSound('sent');
        showToast('Image sent!', 'success');
    } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
    }

    e.target.value = '';
}

function showImage(src) {
    document.getElementById('previewImg').src = src;
    openModal('imagePreviewModal');
}

function deleteMsg(id) {
    deleteTarget = id;
    openModal('deleteModal');
}

async function confirmDelete() {
    if (!deleteTarget || !currentChat) return;

    try {
        if (currentChat.type === 'private') {
            await db.ref('messages/' + currentChat.chatId + '/' + deleteTarget).update({
                deleted: true,
                text: '',
                image: ''
            });
        } else {
            await db.ref('groupMessages/' + currentChat.chatId + '/' + deleteTarget).update({
                deleted: true,
                text: '',
                image: ''
            });
        }

        closeModal('deleteModal');
        deleteTarget = null;
    } catch (e) {
        showToast('Error deleting message', 'error');
    }
}

function goBack() {
    document.getElementById('appContainer').classList.remove('chat-open');
}

async function openChatInfo() {
    if (!currentChat || !currentChat.data) return;

    if (currentChat.type === 'private') {
        // Show friend info
        document.getElementById('friendDetailName').innerText = currentChat.data.name;
        document.getElementById('friendDetailAvatar').innerText = currentChat.data.name.charAt(0);
        document.getElementById('friendDetailBio').innerText = currentChat.data.bio || '-';
        document.getElementById('friendDetailStatus').innerText = currentChat.data.status || '-';

        const lastSeen = currentChat.data.lastSeen ? new Date(currentChat.data.lastSeen).toLocaleString() : 'Unknown';
        document.getElementById('friendDetailLastSeen').innerText = lastSeen;

        openModal('friendModal');
    } else {
        // Show group info
        document.getElementById('groupInfoName').innerText = currentChat.data.name;
        const memberCount = currentChat.data.members ? Object.keys(currentChat.data.members).length : 0;
        document.getElementById('groupInfoMembers').innerText = `${memberCount} members`;

        openModal('groupInfoModal');
    }
}

// ============================================
// Video Call Functions
// ============================================

function setCallUI(status, extraText = '') {
    const overlay = document.getElementById('callStatusOverlay');
    const title = document.getElementById('overlayTitle');
    const text = document.getElementById('overlayStatus');

    if (status === 'calling') {
        overlay.classList.remove('hidden');
        title.innerText = "Calling...";
        text.innerText = "Ringing " + (currentChat && currentChat.data ? currentChat.data.name : '');
    } else if (status === 'connecting') {
        overlay.classList.remove('hidden');
        title.innerText = "Connecting...";
        text.innerText = "Please wait";
    } else if (status === 'connected') {
        overlay.classList.add('hidden');
    } else if (status === 'ended') {
        overlay.classList.remove('hidden');
        title.innerText = "Call Ended";
        text.innerText = extraText || "Disconnected";
    }
}

function createPeerConnection() {
    if (pc) return pc;

    pc = new RTCPeerConnection(servers);

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            handleCandidate(event.candidate);
        }
    };

    pc.onconnectionstatechange = () => {
        console.log("Connection State:", pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
        console.log("ICE State:", pc.iceConnectionState);

        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setCallUI('connected');
        }
    };

    if (myStream) {
        myStream.getTracks().forEach(track => pc.addTrack(track, myStream));
    }

    pc.ontrack = (event) => {
        const remoteVid = document.getElementById('remoteVid');
        if (remoteVid.srcObject !== event.streams[0]) {
            remoteVid.srcObject = event.streams[0];
        }
    };

    return pc;
}

function handleCandidate(candidate) {
    // Overwritten by startCall/answerCall
}

async function processIceCandidatesQueue() {
    if (pc.remoteDescription) {
        while (iceCandidatesQueue.length) {
            const candidate = iceCandidatesQueue.shift();
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                console.error("Error adding queued candidate:", e);
            }
        }
    }
}

async function getMediaStream(videoOn) {
    const constraints = {
        video: videoOn ? {
            facingMode: currentFacingMode,
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 }
        } : false,
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    };

    try {
        return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
        console.error("Media Error:", e);
        showToast("Camera/Mic permission denied or error.", "error");
        throw e;
    }
}

async function startCall(type) {
    if (!currentChat || currentChat.type !== 'private') {
        showToast("Select a friend first", 'error');
        return;
    }

    callType = type;
    callId = Date.now().toString();

    try {
        myStream = await getMediaStream(type === 'video');

        document.getElementById('localVid').srcObject = myStream;
        document.getElementById('remoteLabel').innerText = currentChat.data.name;
        document.getElementById('switchCamBtn').style.display = (type === 'video') ? 'flex' : 'none';

        openModal('callModal');
        setCallUI('calling');

        createPeerConnection();

        handleCandidate = (candidate) => {
            db.ref(`calls/${callId}/callerCandidates`).push(candidate.toJSON());
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await db.ref('calls/' + callId).set({
            caller: me.uid,
            callee: currentChat.id,
            type: type,
            offer: { type: offer.type, sdp: offer.sdp },
            status: 'ringing',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });

        listenForCallStatus();

        answerListener = db.ref(`calls/${callId}/answer`).on('value', async (snapshot) => {
            const data = snapshot.val();

            if (data && !pc.currentRemoteDescription) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(data));
                    await processIceCandidatesQueue();
                } catch (e) {
                    console.error("Error setting remote desc (answer):", e);
                }
            }
        });

        candidateListenerCallee = db.ref(`calls/${callId}/calleeCandidates`).on('child_added', async (snapshot) => {
            const candidate = snapshot.val();

            if (candidate) {
                if (pc.remoteDescription) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error("Error adding callee candidate:", e);
                    }
                } else {
                    iceCandidatesQueue.push(candidate);
                }
            }
        });
    } catch (err) {
        console.error("Call start error:", err);
        showToast("Could not start call: " + err.message, 'error');
        endCall(true);
    }
}

function listenCalls() {
    db.ref('calls')
        .orderByChild('callee')
        .equalTo(me.uid)
        .on('child_added', async snap => {
            const call = snap.val();

            if (call && call.status === 'ringing') {
                if (Date.now() - call.timestamp > 30000) return;

                callId = snap.key;
                callType = call.type;

                try {
                    const uSnap = await db.ref('users/' + call.caller).once('value');
                    const caller = uSnap.val();

                    document.getElementById('callerName').innerText = caller ? caller.name : 'User';
                    document.getElementById('callTypeText').innerText = `Incoming ${call.type} call...`;

                    playSound('ring');
                    openModal('incomingModal');
                } catch (e) {
                    console.error("Incoming call error:", e);
                }
            }
        });
}

async function answerCall() {
    stopSound();
    closeModal('incomingModal');

    try {
        myStream = await getMediaStream(callType === 'video');

        document.getElementById('localVid').srcObject = myStream;
        document.getElementById('switchCamBtn').style.display = (callType === 'video') ? 'flex' : 'none';

        const callSnap = await db.ref('calls/' + callId).once('value');
        const callerId = callSnap.val().caller;

        const uSnap = await db.ref('users/' + callerId).once('value');
        document.getElementById('remoteLabel').innerText = uSnap.val().name;

        openModal('callModal');
        setCallUI('connecting');

        createPeerConnection();

        handleCandidate = (candidate) => {
            db.ref(`calls/${callId}/calleeCandidates`).push(candidate.toJSON());
        };

        if (callSnap.val().offer) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(callSnap.val().offer));
                await processIceCandidatesQueue();

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await db.ref(`calls/${callId}/answer`).set({ type: answer.type, sdp: answer.sdp });
                await db.ref(`calls/${callId}`).update({ status: 'connected' });
            } catch (e) {
                console.error("Error answering:", e);
                showToast("Error connecting call", "error");
                endCall(true);
            }
        }

        candidateListenerCaller = db.ref(`calls/${callId}/callerCandidates`).on('child_added', async (snapshot) => {
            const candidate = snapshot.val();

            if (candidate) {
                if (pc.remoteDescription) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.error("Error adding caller candidate:", e);
                    }
                } else {
                    iceCandidatesQueue.push(candidate);
                }
            }
        });

        listenForCallStatus();
    } catch (err) {
        console.error("Answer call error:", err);
        showToast("Could not answer: " + err.message, 'error');
        endCall(true);
    }
}

function listenForCallStatus() {
    if (callStatusListener) {
        db.ref('calls/' + callId).off('value', callStatusListener);
    }

    callStatusListener = db.ref('calls/' + callId).on('value', (snapshot) => {
        const data = snapshot.val();

        if (!data) return;

        if (data.status === 'connected') {
            callStartTime = Date.now();
            setCallUI('connected');
        }

        if (data.status === 'ended' || data.status === 'rejected') {
            endCall(true);
        }
    });
}

async function endCall(isRemoteEnd) {
    let durationStr = "";

    if (callStartTime) {
        const diff = Math.floor((Date.now() - callStartTime) / 1000);
        durationStr = `${Math.floor(diff / 60)}m ${diff % 60}s`;
    }

    if (!isRemoteEnd && callId) {
        setCallUI('ended', durationStr);
        await db.ref('calls/' + callId).update({ status: 'ended' });
        await new Promise(r => setTimeout(r, 1500));
    }

    // Clean up listeners
    if (answerListener) {
        db.ref(`calls/${callId}/answer`).off('value', answerListener);
        answerListener = null;
    }

    if (candidateListenerCaller) {
        db.ref(`calls/${callId}/calleeCandidates`).off('child_added', candidateListenerCaller);
        candidateListenerCaller = null;
    }

    if (candidateListenerCallee) {
        db.ref(`calls/${callId}/callerCandidates`).off('child_added', candidateListenerCallee);
        candidateListenerCallee = null;
    }

    if (callStatusListener) {
        db.ref('calls/' + callId).off('value', callStatusListener);
        callStatusListener = null;
    }

    closeModal('callModal');
    closeModal('incomingModal');
    stopSound();

    if (pc) {
        pc.close();
        pc = null;
    }

    if (myStream) {
        myStream.getTracks().forEach(t => t.stop());
        myStream = null;
    }

    iceCandidatesQueue = [];
    callStartTime = null;
    callId = null;
}

async function rejectCall() {
    stopSound();

    if (callId) {
        await db.ref(`calls/${callId}`).update({ status: 'rejected' });
    }

    closeModal('incomingModal');
    callId = null;
}

function toggleMic() {
    if (myStream) {
        const track = myStream.getAudioTracks()[0];

        if (track) {
            track.enabled = !track.enabled;

            const btn = document.getElementById('micBtn');
            btn.classList.toggle('active', !track.enabled);
        }
    }
}

function toggleCam() {
    if (myStream && callType === 'video') {
        const track = myStream.getVideoTracks()[0];

        if (track) {
            track.enabled = !track.enabled;

            const btn = document.getElementById('camBtn');
            btn.classList.toggle('active', !track.enabled);
        }
    }
}

async function switchCamera() {
    if (callType !== 'video' || !myStream) return;

    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

    try {
        const newStream = await getMediaStream(true);
        const newVideoTrack = newStream.getVideoTracks()[0];

        const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');

        if (sender) await sender.replaceTrack(newVideoTrack);

        const oldVideoTrack = myStream.getVideoTracks()[0];
        if (oldVideoTrack) oldVideoTrack.stop();

        myStream.removeTrack(myStream.getVideoTracks()[0]);
        myStream.addTrack(newVideoTrack);

        document.getElementById('localVid').srcObject = myStream;

        showToast("Camera Switched", "info");
    } catch (e) {
        console.error(e);
        showToast("Could not switch camera", "error");
    }
}
