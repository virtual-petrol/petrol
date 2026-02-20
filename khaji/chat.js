<!DOCTYPE html>
<html>
<head>
  <title>Chat</title>
  <meta charset="UTF-8">
</head>
<body>

<h2>Chat</h2>

<input type="text" id="searchEmail" placeholder="Search by Email">
<button id="searchBtn">Search</button>

<div id="userList"></div>

<hr>

<div id="chatBox" style="height:200px; overflow-y:auto; border:1px solid black;"></div>

<br>
<input type="text" id="messageInput" placeholder="Type message">
<button id="sendBtn">Send</button>

<br><br>
<button id="logoutBtn">Logout</button>

<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

<script src="chat.js"></script>

</body>
</html>
