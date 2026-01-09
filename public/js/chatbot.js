const toggleBtn = document.getElementById('chat-toggle');
const chatbot = document.getElementById('chatbot');
const messages = document.getElementById('chat-messages');
const input = document.getElementById('messageInput');

// Toggle open/close
toggleBtn.addEventListener('click', () => {
  chatbot.style.display =
    chatbot.style.display === 'flex' ? 'none' : 'flex';
});

function addMessage(text, sender) {
  const div = document.createElement('div');
  div.className = `msg ${sender}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  addMessage(text, 'user');
  addMessage('...', 'bot');

  try {
    const res = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();

    messages.removeChild(messages.lastChild);
    addMessage(data.reply, 'bot');
  } catch {
    messages.removeChild(messages.lastChild);
    addMessage('⚠️ Server error. Try again.', 'bot');
  }
}
