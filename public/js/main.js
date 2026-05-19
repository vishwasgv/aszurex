document.addEventListener('DOMContentLoaded', function() {
  loadHomeServices();
  loadServicesPage();
  handleContactForm();
  handleCareerForm();
  initSmoothScroll();
  initMobileMenu();
  initNavScroll();
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

function loadHomeServices() {
  const servicesGrid = document.querySelector('.services-grid');
  if (!servicesGrid || !SITE_CONFIG) return;
  
  const servicesToShow = SITE_CONFIG.services.slice(0, 6);
  servicesGrid.innerHTML = servicesToShow.map((service, index) => `
    <div class="service-card">
      <div class="service-icon ${index === 4 ? 'featured' : ''}">
        ${service.icon}
      </div>
      <h3 class="service-title">${service.title}</h3>
      <p class="service-description">${service.description}</p>
    </div>
  `).join('');
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
      name: document.getElementById('name').value,
      email: document.getElementById('email').value,
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
    } catch (error) {
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
    if (resumeFile) {
      formData.append('resume', resumeFile);
    }
    
    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (result.success) {
        showMessage('success', 'Application submitted successfully!');
        careerForm.reset();
      } else {
        showMessage('error', result.message || 'Failed to submit application.');
      }
    } catch (error) {
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
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

function initPageScroll() {
  const sequence = ['/', '/services.html', '/about.html', '/careers.html', '/contact.html'];
  const names    = ['Home', 'Services', 'About', 'Careers', 'Contact'];

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

  // Fade-in if arriving via scroll navigation
  if (sessionStorage.getItem('scroll-nav')) {
    sessionStorage.removeItem('scroll-nav');
    document.body.style.animation = 'pageFadeIn 0.35s ease both';
  }

  // Build hint pill
  if (nextUrl) {
    const hint = document.createElement('div');
    hint.id = 'page-scroll-hint';
    hint.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>${nextName}`;
    document.body.appendChild(hint);

    window.addEventListener('scroll', () => {
      const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 200;
      hint.classList.toggle('visible', nearBottom);
    }, { passive: true });
  }

  let transitioning = false;
  let accumDown = 0;
  let accumUp   = 0;
  let resetTimer = null;
  const THRESHOLD = 400;

  window.addEventListener('wheel', (e) => {
    if (transitioning) return;

    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { accumDown = 0; accumUp = 0; }, 700);

    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    const atTop    = window.scrollY <= 0;

    if (e.deltaY > 0 && atBottom && nextUrl) {
      accumDown += e.deltaY;
      accumUp = 0;
      if (accumDown >= THRESHOLD) goTo(nextUrl);
    } else if (e.deltaY < 0 && atTop && prevUrl) {
      accumUp += Math.abs(e.deltaY);
      accumDown = 0;
      if (accumUp >= THRESHOLD) goTo(prevUrl);
    } else {
      accumDown = 0;
      accumUp   = 0;
    }
  }, { passive: true });

  // Touch swipe support
  let touchStartY = 0;
  window.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener('touchend', e => {
    if (transitioning) return;
    const dy      = touchStartY - e.changedTouches[0].clientY;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    const atTop    = window.scrollY <= 0;
    if (dy >  55 && atBottom && nextUrl) goTo(nextUrl);
    if (dy < -55 && atTop    && prevUrl) goTo(prevUrl);
  }, { passive: true });

  function goTo(url) {
    if (transitioning) return;
    transitioning = true;
    sessionStorage.setItem('scroll-nav', '1');
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#06090F;opacity:0;transition:opacity 0.35s ease;z-index:9999;pointer-events:none;';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    setTimeout(() => { window.location.href = url; }, 370);
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
  @keyframes pageFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);
