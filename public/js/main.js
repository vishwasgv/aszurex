document.addEventListener('DOMContentLoaded', function() {
  loadHomeServices();
  loadServicesPage();
  handleContactForm();
  handleCareerForm();
  initSmoothScroll();
});

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
  
  allServicesGrid.innerHTML = SITE_CONFIG.services.map((service, index) => `
    <div class="service-detail-card" id="${service.id}">
      <div class="service-icon ${[3, 4, 5].includes(index) ? 'featured' : ''}">
        ${service.icon}
      </div>
      <h3 class="service-title">${service.title}</h3>
      <p class="service-description">${service.description}</p>
      <div class="service-features-section">
        <h4>WHAT WE DO:</h4>
        <ul class="service-features">
          ${service.features.map(feature => `<li>${feature}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');
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
