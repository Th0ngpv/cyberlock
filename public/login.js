async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const msg = document.getElementById('loginMessage');

  msg.textContent = 'AUTHENTICATING...';

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    msg.textContent = data.error;
    return;
  }

  msg.textContent = 'ACCESS GRANTED';
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 800);
}

async function register() {
  const name = document.getElementById('name').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const msg = document.getElementById('loginMessage');

  if (!name || !email || !password) {
    msg.textContent = 'ALL FIELDS REQUIRED';
    return;
  }

  msg.textContent = 'CREATING ACCOUNT...';

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });

  const data = await res.json();

  msg.textContent = res.ok
    ? 'ACCOUNT CREATED — PLEASE LOGIN'
    : data.error;
}
