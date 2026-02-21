const toggle = document.querySelector('.menu-toggle');
const links = document.querySelector('.nav-links');

if (toggle && links) {
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => links.classList.remove('open')));
}

const slides = Array.from(document.querySelectorAll('.slide'));
const dotsWrap = document.querySelector('.dots');
const prev = document.querySelector('.prev');
const next = document.querySelector('.next');
let current = 0;

function renderDots() {
  if (!dotsWrap) return;
  dotsWrap.innerHTML = '';
  slides.forEach((_, idx) => {
    const dot = document.createElement('button');
    dot.className = `dot ${idx === current ? 'active' : ''}`;
    dot.setAttribute('aria-label', `Слайд ${idx + 1}`);
    dot.addEventListener('click', () => show(idx));
    dotsWrap.appendChild(dot);
  });
}

function show(index) {
  slides[current]?.classList.remove('active');
  current = (index + slides.length) % slides.length;
  slides[current]?.classList.add('active');
  renderDots();
}

if (slides.length) {
  prev?.addEventListener('click', () => show(current - 1));
  next?.addEventListener('click', () => show(current + 1));

  let startX = 0;
  const slider = document.querySelector('.slides');
  slider?.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });
  slider?.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 40) show(current + (diff < 0 ? 1 : -1));
  });

  setInterval(() => show(current + 1), 5500);
  renderDots();
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  },
  { threshold: 0.2 }
);

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
