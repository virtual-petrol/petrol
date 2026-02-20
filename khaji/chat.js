// Keep your firebase config same

// Add this inside startChat()
document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
event.currentTarget.classList.add('active');

// Improved message rendering
unsubChat = onSnapshot(q, (snapshot) => {
  const container = document.getElementById('messages-container');
  container.innerHTML = '';

  snapshot.forEach(doc => {
    const msg = doc.data();
    const div = document.createElement('div');
    div.className = `message-row ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
    div.innerHTML = `<div class="message-bubble">${msg.text}</div>`;
    container.appendChild(div);
  });

  container.scrollTop = container.scrollHeight;
});

// End Call Button
function endCall() {
  if (currentCall) currentCall.close();
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  document.getElementById('video-grid').classList.add('hidden');
}

// Add button dynamically
const endBtn = document.createElement('button');
endBtn.className = 'video-end';
endBtn.innerText = 'End Call';
endBtn.onclick = endCall;
document.getElementById('video-grid').appendChild(endBtn);
