'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // ---------- Helpers ----------
  const FALLBACKS = {
    headshot: './images/headshot.webp',
    cardBg: './images/card_placeholder_bg.webp',
    spotlightBg: './images/spotlight_placeholder_bg.webp',
    noTitle: 'Untitled Project',
    noShort: 'Description coming soon…',
    noLong: 'No details yet.',
    noUrl: '#'
  };

  // Normalize relative paths like "../images/..." → "./images/..."
  function fixPath(p, fallback) {
    if (!p || typeof p !== 'string') return fallback;
    // strip leading ../ segments, ensure starts with ./
    const normalized = p.replace(/^(\.\.\/)+/g, './');
    // If someone provided "images/..." without "./", prefix it
    if (/^images\//.test(normalized)) return `./${normalized}`;
    // If already absolute http(s), keep as is
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return normalized;
  }

  // Safe text
  const t = (v, fb) => (v == null || v === '' ? fb : v);

  // ---------- ABOUT ----------
  const aboutMeElement = document.getElementById('aboutMe');
  try {
    const res = await fetch('./data/aboutMeData.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const headshotSrc = fixPath(data.headshot, FALLBACKS.headshot);
    aboutMeElement.innerHTML = `
      <p>${t(data.aboutMe, 'Bio not available.')}</p>
      <div class="headshotContainer">
        <img src="${headshotSrc}" alt="Headshot" />
      </div>
    `;
  } catch (err) {
    console.error('Error fetching aboutMeData.json:', err);
    if (aboutMeElement) {
      aboutMeElement.innerHTML = `
        <p>Could not load the "About Me" section.</p>
        <div class="headshotContainer">
          <img src="${FALLBACKS.headshot}" alt="Headshot" />
        </div>
      `;
    }
  }

  // ---------- PROJECTS ----------
  const projectListElement = document.getElementById('projectList');
  const projectSpotlightElement = document.getElementById('projectSpotlight');

  // Update spotlight content (uses <img>, not background-image, for better loading)
  function updateSpotlight(project) {
    if (!projectSpotlightElement) return;

    const spotlightImgSrc = fixPath(project.spotlight_image, FALLBACKS.spotlightBg);
    const title = t(project.project_name, FALLBACKS.noTitle);
    const desc = t(project.long_description, FALLBACKS.noLong);
    const url = t(project.url, FALLBACKS.noUrl);

    const spotlightImgHTML = spotlightImgSrc
      ? `<div class="spotlightImage"><img src="${spotlightImgSrc}" alt="${title} spotlight image" /></div>`
      : '';

    projectSpotlightElement.innerHTML = `
      <h3 id="spotlightTitles">${title}</h3>
      ${spotlightImgHTML}
      <p>${desc}</p>
      <a href="${url}" ${url === '#' ? '' : 'target="_blank" rel="noopener noreferrer"'}>Click here to see more...</a>
    `;
  }

  try {
    const res = await fetch('./data/projectsData.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const projects = await res.json();

    if (projectListElement && Array.isArray(projects)) {
      const frag = document.createDocumentFragment();

      projects.forEach((project) => {
        const card = document.createElement('div');
        card.className = 'projectCard';
        card.id = project.project_id;

        // Card background (CSS background-image)
        const bg = fixPath(project.card_image, FALLBACKS.cardBg);
        card.style.backgroundImage = `url("${bg}")`;
        card.style.backgroundSize = 'cover';
        card.style.backgroundPosition = 'center';

        // Text overlay (same structure you liked)
        const title = t(project.project_name, FALLBACKS.noTitle);
        const short = t(project.short_description, FALLBACKS.noShort);

        card.innerHTML = `
          <h4>${title}</h4>
          <p>${short}</p>
        `;

        // Click → update spotlight
        card.addEventListener('click', () => updateSpotlight(project));
        frag.appendChild(card);
      });

      projectListElement.innerHTML = ''; // clear before append
      projectListElement.appendChild(frag);

      // Default spotlight to first project
      if (projects.length > 0) updateSpotlight(projects[0]);
    }

    // ---- Scrolling functionality (fixed: use projectListElement consistently) ----
    const arrowLeft = document.querySelector('.arrow-left');
    const arrowRight = document.querySelector('.arrow-right');
    let scrollDirection = 'horizontal'; // default for mobile

    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const updateScrollDirection = (eOrMQ) => {
      const matches = 'matches' in eOrMQ ? eOrMQ.matches : eOrMQ.target.matches;
      scrollDirection = matches ? 'horizontal' : 'vertical';
    };
    updateScrollDirection(mobileQuery);
    mobileQuery.addEventListener('change', updateScrollDirection);

    const calculateScrollSize = () => {
      if (!projectListElement) return 100;
      if (scrollDirection === 'horizontal') {
        // one "page" to the left/right
        return projectListElement.offsetWidth - 40;
      } else {
        // one "page" up/down
        return projectListElement.offsetHeight - 40 || 100;
      }
    };

    const scrollProjectList = (direction) => {
      if (!projectListElement) return;
      const amount = calculateScrollSize();
      if (scrollDirection === 'horizontal') {
        projectListElement.scrollBy({
          left: direction === 'left' ? -amount : amount,
          behavior: 'smooth'
        });
      } else {
        projectListElement.scrollBy({
          top: direction === 'up' ? -amount : amount,
          behavior: 'smooth'
        });
      }
    };

    arrowLeft?.addEventListener('click', () => {
      scrollProjectList(scrollDirection === 'horizontal' ? 'left' : 'up');
    });
    arrowRight?.addEventListener('click', () => {
      scrollProjectList(scrollDirection === 'horizontal' ? 'right' : 'down');
    });
  } catch (err) {
    console.error('Error fetching projectsData.json:', err);
    if (projectSpotlightElement) {
      projectSpotlightElement.innerHTML = `
        <h3 id="spotlightTitles">${FALLBACKS.noTitle}</h3>
        <div class="spotlightImage"><img src="${FALLBACKS.spotlightBg}" alt="Spotlight placeholder" /></div>
        <p>${FALLBACKS.noLong}</p>
        <a href="#">Click here to see more...</a>
      `;
    }
  }

  // ---------- CONTACT / VALIDATION / MODAL ----------
  const form = document.getElementById('formSection');
  const emailInput = document.getElementById('contactEmail');
  const messageInput = document.getElementById('contactMessage');
  const emailError = document.getElementById('emailError');
  const messageError = document.getElementById('messageError');
  const charactersLeft = document.getElementById('charactersLeft');

  const maxMessageLength = 300;
  const illegalCharsRegex = /[^a-zA-Z0-9@._-]/;
  const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Live character counter (with safety checks)
  if (messageInput && charactersLeft) {
    messageInput.addEventListener('input', () => {
      const len = messageInput.value.length;
      charactersLeft.textContent = `Characters: ${len}/${maxMessageLength}`;
      charactersLeft.style.color = len > maxMessageLength ? 'red' : 'black';
    });
  }

  // Modal elements
  const modal = document.getElementById('modal');
  const modalMessage = document.getElementById('modalMessage');
  const closeModal = document.getElementById('closeModal');

  function showModal(message) {
    if (!modal || !modalMessage) return;
    modalMessage.textContent = message;
    modal.style.display = 'block';
  }

  closeModal?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  window.addEventListener('click', (evt) => {
    if (evt.target === modal) modal.style.display = 'none';
  });

  // Form validation
  form?.addEventListener('submit', (evt) => {
    evt.preventDefault();

    // Clear old errors
    if (emailError) emailError.textContent = '';
    if (messageError) messageError.textContent = '';

    let ok = true;

    const emailVal = emailInput?.value.trim() ?? '';
    const msgVal = messageInput?.value.trim() ?? '';

    if (!emailVal) {
      emailError && (emailError.textContent = 'Email is required.');
      ok = false;
    } else if (!validEmailRegex.test(emailVal)) {
      emailError && (emailError.textContent = 'Invalid email format.');
      ok = false;
    } else if (illegalCharsRegex.test(emailVal)) {
      emailError && (emailError.textContent = 'Email contains illegal characters.');
      ok = false;
    }

    if (!msgVal) {
      messageError && (messageError.textContent = 'Message is required.');
      ok = false;
    } else if (illegalCharsRegex.test(msgVal)) {
      messageError && (messageError.textContent = 'Message contains illegal characters.');
      ok = false;
    } else if (msgVal.length > maxMessageLength) {
      messageError && (messageError.textContent = `Message exceeds the maximum length of ${maxMessageLength} characters.`);
      ok = false;
    }

    if (ok) {
      showModal('Form validation passed! Your message has been accepted.');
      form.reset();
      if (charactersLeft) charactersLeft.textContent = `Characters: 0/${maxMessageLength}`;
      if (charactersLeft) charactersLeft.style.color = 'black';
    }
  });
});
