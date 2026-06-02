document.addEventListener('DOMContentLoaded', function() {
  loadServicesPage();
  handleContactForm();
  initMobileMenu();
  initNavScroll();
  initSmoothScroll();
  initScrollReveal();
  handleCareerForm();
  initPageScroll();
});

function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');
  if (!hamburger || !navMenu) return;

  hamburger.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('nav-open');
    hamburger.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('nav-open');
      hamburger.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

function loadServicesPage() {
  const allServicesGrid = document.querySelector('.all-services-grid');
  if (!allServicesGrid || !SITE_CONFIG) return;

  allServicesGrid.innerHTML = SITE_CONFIG.services.map((service) => {
    const imgHtml = service.image
      ? `<div class="service-card-img-wrap"><img class="service-card-img" src="${service.image}" alt="${service.title}" loading="lazy" width="400" height="168"></div>`
      : '';
    const open  = service.image ? '<div class="service-card-content">' : '';
    const close = service.image ? '</div>' : '';
    return `
    <div class="service-detail-card${service.image ? ' has-img' : ''}" id="${service.id}">
      ${imgHtml}
      ${open}
        <div class="service-icon">${service.icon}</div>
        <h3 class="service-title">${service.title}</h3>
        <p class="service-description">${service.description}</p>
        <div class="service-features-section">
          <h4>WHAT WE DO:</h4>
          <ul class="service-features">
            ${service.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
      ${close}
    </div>`;
  }).join('');
}

function handleContactForm() {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const formData = {
      name:    document.getElementById('name').value,
      email:   document.getElementById('email').value,
      company: document.getElementById('company').value,
      message: document.getElementById('message').value
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const result = await response.json();
      if (result.success) {
        showMessage('success', 'Thank you! Your message has been sent successfully.');
        contactForm.reset();
      } else {
        showMessage('error', result.message || 'Failed to send message.');
      }
    } catch {
      showMessage('error', 'An error occurred. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function handleCareerForm() {
  const careerForm = document.getElementById('careerForm');
  if (!careerForm) return;

  careerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = careerForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const formData = new FormData();
    formData.append('name', document.getElementById('applicantName').value);
    formData.append('email', document.getElementById('applicantEmail').value);
    formData.append('phone', document.getElementById('applicantPhone').value);
    formData.append('position', document.getElementById('position').value);
    formData.append('experience', document.getElementById('experience').value);
    formData.append('coverLetter', document.getElementById('coverLetter').value);
    const resumeFile = document.getElementById('resume').files[0];
    if (resumeFile) formData.append('resume', resumeFile);

    try {
      const response = await fetch('/api/apply', { method: 'POST', body: formData });
      const result = await response.json();
      if (result.success) {
        showMessage('success', 'Application submitted successfully!');
        careerForm.reset();
      } else {
        showMessage('error', result.message || 'Failed to submit application.');
      }
    } catch {
      showMessage('error', 'An error occurred. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

function showMessage(type, message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message-alert message-${type}`;
  messageDiv.textContent = message;
  messageDiv.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 16px 24px;
    background: ${type === 'success' ? '#10B981' : '#EF4444'};
    color: white; border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 1000; animation: slideIn 0.3s ease;
  `;
  document.body.appendChild(messageDiv);
  setTimeout(() => {
    messageDiv.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => messageDiv.remove(), 300);
  }, 5000);
}

function initNavScroll() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;
  const darkTop = document.querySelector('.hero-dark, .page-header');
  if (!darkTop) {
    navbar.classList.add('nav-light');
    return;
  }
  const update = () => {
    if (darkTop.getBoundingClientRect().bottom <= 0) {
      navbar.classList.add('nav-light');
    } else {
      navbar.classList.remove('nav-light');
    }
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#' && href !== '#!') {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

function initScrollReveal() {
  const vh = window.innerHeight;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  function revealEl(el, delay) {
    if (el.getBoundingClientRect().top >= vh * 0.92) {
      el.classList.add('reveal');
      if (delay > 0) el.style.transitionDelay = `${delay}s`;
      observer.observe(el);
    }
  }

  const grids = [
    ['.services-ed-list', '.sed-item'],
    ['.work-grid', '.work-card'],
    ['.process-grid', '.process-step'],
    ['.testi-grid', '.testi-card'],
    ['.qual-grid', '.qual-card'],
    ['.service-area-grid', '.service-area-card'],
    ['.all-services-grid', '.service-detail-card'],
    ['.values-grid', '.value-card'],
    ['.benefits-grid', '.benefit-card'],
    ['.proof-grid', '.proof-card'],
    ['.stats-grid', '.stat-item'],
  ];

  grids.forEach(([gridSel, itemSel]) => {
    const grid = document.querySelector(gridSel);
    if (!grid) return;
    grid.querySelectorAll(itemSel).forEach((el, i) => revealEl(el, (i % 4) * 0.09));
  });

  [
    '.about-img-wrap', '.about-text', '.careers-cta-box', '.careers-text',
    '.contact-form-wrap', '.contact-info-img', '.contact-item', '.contact-why-box',
    '.process-visual-wrap', '.about-workflow-visual', '.careers-culture-img',
    '.hero-float-card', '.vision-callout', '.founder-philosophy',
  ].forEach(sel => {
    document.querySelectorAll(sel).forEach(el => revealEl(el, 0));
  });

  document.querySelectorAll('.section-hdr-inner').forEach(el => revealEl(el, 0));
}

function initPageScroll() {
  const sequence = ['/', '/services.html', '/about.html', '/careers.html', '/delivery-partnerships', '/contact.html'];
  const names    = ['Home', 'Services', 'About', 'Careers', 'Partners', 'Contact'];

  const path = window.location.pathname;
  const idx  = sequence.findIndex(p =>
    p === '/'
      ? (path === '/' || path === '/index.html' || path === '')
      : path === p || path.endsWith(p.replace('/', ''))
  );
  if (idx === -1) return;

  const nextUrl  = sequence[idx + 1] || null;
  const prevUrl  = sequence[idx - 1] || null;
  const nextName = names[idx + 1]    || null;

  let prefetched = false;
  if (nextUrl) {
    const hint = document.createElement('div');
    hint.id = 'page-scroll-hint';
    hint.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>${nextName}`;
    document.body.appendChild(hint);

    window.addEventListener('scroll', () => {
      const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 200;
      hint.classList.toggle('visible', nearBottom);
      if (nearBottom && !prefetched) {
        prefetched = true;
        const link = document.createElement('link');
        link.rel = 'prefetch'; link.href = nextUrl;
        document.head.appendChild(link);
      }
    }, { passive: true });
  }

  let transitioning = false, accumDown = 0, accumUp = 0, resetTimer = null;
  const THRESHOLD = 400;

  window.addEventListener('wheel', (e) => {
    if (transitioning) return;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { accumDown = 0; accumUp = 0; }, 700);
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    const atTop    = window.scrollY <= 0;
    if (e.deltaY > 0 && atBottom && nextUrl) {
      accumDown += e.deltaY; accumUp = 0;
      if (accumDown >= THRESHOLD) goTo(nextUrl);
    } else if (e.deltaY < 0 && atTop && prevUrl) {
      accumUp += Math.abs(e.deltaY); accumDown = 0;
      if (accumUp >= THRESHOLD) goTo(prevUrl);
    } else { accumDown = 0; accumUp = 0; }
  }, { passive: true });

  let touchStartY = 0;
  window.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    if (transitioning) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    const atTop    = window.scrollY <= 0;
    if (dy >  55 && atBottom && nextUrl) goTo(nextUrl);
    if (dy < -55 && atTop    && prevUrl) goTo(prevUrl);
  }, { passive: true });

  function goTo(url) {
    if (transitioning) return;
    transitioning = true;
    window.location.href = url;
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);
