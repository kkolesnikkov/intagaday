/* ИнтаГадай — логика игры */
'use strict';

const $ = (id) => document.getElementById(id);

// ---------- Состояние ----------
let deck = [];        // порядок квартир в текущей игре
let roundIdx = 0;     // текущий раунд 0..9
let totalScore = 0;
let rounds = [];      // {guess, real, pts, dev, signed}

// ---------- Утилиты ----------
const fmt = (n) => n.toLocaleString('ru-RU') + ' ₽';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  $(screenId).classList.remove('hidden');
  window.scrollTo(0, 0);
}

// ---------- Баллы ----------
// Точность: |оценка − реальная цена| / реальная цена.
// ≤3% → 100 баллов, дальше −1 балл за каждый % отклонения, минимум 0.
function calcPoints(guess, real) {
  const dev = Math.abs(guess - real) / real * 100;
  const pts = dev <= 3 ? 100 : Math.max(0, Math.round(100 - dev));
  return { dev, pts };
}

// ---------- Прогресс-бар ----------
function updateProgress() {
  const wrap = $('progress-wrap');
  wrap.classList.remove('hidden');
  $('progress-label').textContent = `Квартира ${Math.min(roundIdx + 1, 10)} из 10`;
  $('progress-score').textContent = `${totalScore} баллов`;
  $('progress-bar').style.width = `${(roundIdx / 10) * 100}%`;
}

// ---------- Раунд ----------
function setupRound() {
  const flat = deck[roundIdx];
  updateProgress();

  $('round-street').textContent = '📍 ' + flat.street;
  $('round-desc').textContent = flat.desc + ' · ' + flat.ppm.replace(/\xa0/g, ' ');

  // Галерея
  const gallery = $('gallery');
  gallery.innerHTML = '';
  gallery.scrollLeft = 0;
  flat.photos.forEach((src, i) => {
    const img = new Image();
    img.src = src;
    img.alt = `Фото ${i + 1}`;
    img.loading = i === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.width = 900; img.height = 675;
    gallery.appendChild(img);
  });
  buildDots(flat.photos.length);

  // Бегунок
  const slider = $('price-slider');
  slider.value = 300000;
  updateSliderFill();
  $('guess-value').textContent = fmt(300000);

  show('screen-round');
}

function buildDots(n) {
  const dots = $('gallery-dots');
  dots.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const b = document.createElement('button');
    b.className = 'dot' + (i === 0 ? ' active' : '');
    b.setAttribute('aria-label', `Фото ${i + 1}`);
    b.addEventListener('click', () => {
      $('gallery').scrollTo({ left: (i * $('gallery').clientWidth), behavior: 'smooth' });
    });
    dots.appendChild(b);
  }
}

function updateDots() {
  const gallery = $('gallery');
  const idx = Math.round(gallery.scrollLeft / gallery.clientWidth);
  document.querySelectorAll('#gallery-dots .dot').forEach((d, i) => {
    d.classList.toggle('active', i === idx);
  });
}

function updateSliderFill() {
  const s = $('price-slider');
  const pct = (s.value - s.min) / (s.max - s.min) * 100;
  s.style.setProperty('--fill', pct + '%');
}

// ---------- Результат раунда ----------
function showResult() {
  const flat = deck[roundIdx];
  const guess = Number($('price-slider').value);
  const real = flat.price;
  const { dev, pts } = calcPoints(guess, real);
  const signed = (guess - real) / real * 100;

  totalScore += pts;
  rounds.push({ guess, real, pts, dev, signed });

  // Вердикт за раунд
  let emoji, verdict;
  if (dev <= 3)      { emoji = '🎯'; verdict = 'В точку!'; }
  else if (dev <= 10){ emoji = '👏'; verdict = 'Почти точно'; }
  else if (dev <= 25){ emoji = '🙂'; verdict = 'Близко'; }
  else if (dev <= 50){ emoji = '🤔'; verdict = 'Так себе'; }
  else               { emoji = '😅'; verdict = 'Промах'; }
  $('res-emoji').textContent = emoji;
  $('res-verdict').textContent = verdict;

  $('res-guess').textContent = fmt(guess);
  $('res-real').textContent = fmt(real);

  const diff = guess - real;
  const diffEl = $('res-diff');
  diffEl.classList.remove('over', 'under', 'exact');
  if (Math.abs(diff) < 1) {
    diffEl.textContent = 'Идеальное попадание!';
    diffEl.classList.add('exact');
  } else if (diff > 0) {
    diffEl.textContent = `Переплата: +${fmt(diff)} (${signed.toFixed(0)}% выше реальной)`;
    diffEl.classList.add('over');
  } else {
    diffEl.textContent = `Экономия: −${fmt(-diff)} (${Math.abs(signed).toFixed(0)}% ниже реальной)`;
    diffEl.classList.add('under');
  }

  $('res-points').textContent = `+${pts} баллов`;
  $('res-details').innerHTML =
    `Отклонение: <b>${dev.toFixed(1)}%</b><br>` +
    `${flat.desc} · ${flat.ppm.replace(/\xa0/g, ' ')}`;

  $('res-link').href = flat.url;
  $('btn-next').textContent = roundIdx === 9 ? 'К результатам игры →' : 'Следующая квартира';

  updateProgress();
  show('screen-result');
}

// ---------- Финал ----------
function showFinal() {
  $('progress-bar').style.width = '100%';
  $('progress-label').textContent = 'Игра завершена';
  $('progress-score').textContent = `${totalScore} баллов`;

  const avgSigned = rounds.reduce((s, r) => s + r.signed, 0) / rounds.length;
  const avgDev = rounds.reduce((s, r) => s + r.dev, 0) / rounds.length;
  const overpaySum = rounds.reduce((s, r) => s + (r.guess - r.real), 0);

  // Три финала по среднему знаковому отклонению оценки
  let emoji, title, desc;
  if (avgSigned <= -10) {
    emoji = '🧐';
    title = 'Жадный студент';
    desc = 'Ты почти всегда ставил цены заметно ниже реальных. Скряга! Такие квартиры в Коми не раздают бесплатно — но, может, ты просто видел слишком много «хрущёвок за три копейки». Копи на котелок дальше!';
  } else if (avgSigned >= 10) {
    emoji = '🤑';
    title = 'Транжира';
    desc = 'Ты стабильно завышал цены. С такими талантами ты переплатил бы за каждую вторую квартиру! Ремонт за счёт покупателя — это, конечно, благородно, но кошелёк так не думает.';
  } else {
    emoji = '🤝';
    title = 'Адекватный квартирант';
    desc = 'Твои оценки почти совпали с реальной стоимостью. Ты трезво смотришь на рынок — риелторы из Инты рвали бы тебя в первый же день. Осталось только съездить туда и вложить талант!';
  }
  $('fin-emoji').textContent = emoji;
  $('fin-title').textContent = title;
  $('fin-desc').textContent = desc;

  $('fin-score').textContent = String(totalScore);
  $('fin-accuracy').textContent = Math.max(0, Math.round(100 - avgDev)) + '%';
  $('fin-overpay').textContent = (overpaySum >= 0 ? '+' : '−') + fmt(Math.abs(Math.round(overpaySum))).replace(' ₽', '');
  $('fin-overpay-cap').textContent = overpaySum >= 0 ? 'сумма переплаты' : 'сумма экономии';

  // Список раундов
  const list = $('fin-rounds');
  list.innerHTML = '';
  rounds.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'round-row';
    row.innerHTML = `<span>${i + 1}. ${fmt(r.real)}</span><span class="pts">+${r.pts}</span>`;
    list.appendChild(row);
  });

  show('screen-final');
}

// ---------- Запуск игры ----------
function startGame() {
  deck = shuffle(APARTMENTS);
  roundIdx = 0;
  totalScore = 0;
  rounds = [];
  setupRound();
}

function nextRound() {
  roundIdx++;
  if (roundIdx < 10) setupRound();
  else showFinal();
}

// ---------- Слушатели ----------
$('btn-start').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', startGame);
$('btn-evaluate').addEventListener('click', showResult);
$('btn-next').addEventListener('click', nextRound);

$('price-slider').addEventListener('input', () => {
  $('guess-value').textContent = fmt(Number($('price-slider').value));
  updateSliderFill();
});

$('gallery').addEventListener('scroll', updateDots, { passive: true });
