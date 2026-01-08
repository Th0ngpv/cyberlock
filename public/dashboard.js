document.addEventListener('DOMContentLoaded', loadDashboard);

async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');

    if (!res.ok) {
      location.href = '/login.html';
      return;
    }

    const data = await res.json();

    // User info
    document.getElementById('username').textContent = data.user.username;
    document.getElementById('email').textContent = data.user.email;
    document.getElementById('joined').textContent =
      new Date(data.user.joined).toLocaleDateString();

    // Overall progress
    document.getElementById('overallProgress').style.width =
      data.stats.percentage + '%';
    document.getElementById('overallText').textContent =
      `${data.stats.completedCategories} / ${data.stats.totalCategories} categories completed (${data.stats.percentage}%)`;

    // Categories
    renderCategories(data.progress);
  } catch (err) {
    console.error('Dashboard load failed', err);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      const data = await res.json();

      if (res.ok) {
        alert('Logged out successfully!');
        window.location.href = '/login.html';
      } else {
        alert('Logout failed: ' + data.message);
      }
    } catch (err) {
      console.error('Logout error:', err);
      alert('Logout failed');
    }
  });
});


function renderCategories(categories) {
  const container = document.getElementById('categoryList');
  container.innerHTML = '';

  Object.entries(categories).forEach(([name, prog]) => {
    const percent = calcCategoryPercent(prog);

    const card = document.createElement('div');
    card.className = 'category-card';

    card.innerHTML = `
      <h3>${name.replace('_', ' ').toUpperCase()}</h3>

      <p class="status ${prog.quiz ? 'done' : 'pending'}">
        ${prog.quiz ? '✔' : '✖'} QUIZ
      </p>

      <p class="status ${prog.cards ? 'done' : 'pending'}">
        ${prog.cards ? '✔' : '✖'} CARDS
      </p>

      <p class="status ${prog.test ? 'done' : 'pending'}">
        ${prog.test ? '✔' : '✖'} TEST
        ${
          prog.test
            ? `(${prog.testScore} / ${prog.testMaxScore})`
            : '(0 / 10)'
        }
      </p>

      <div class="progress-bar">
        <div class="progress-fill" style="width:${percent}%"></div>
      </div>

      <p style="font-size:11px;">${percent}% COMPLETE</p>
    `;

    container.appendChild(card);
  });
}


function calcCategoryPercent(p) {
  let total = 3;
  let done = 0;
  if (p.quiz) done++;
  if (p.cards) done++;
  if (p.test) done++;
  return Math.round((done / total) * 100);
}
