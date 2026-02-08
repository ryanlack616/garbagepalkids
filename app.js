/**
 * GarbagePal Kids — Multi-Series Gallery App
 * Loads card manifest with collections, renders gallery with series filter,
 * handles lightbox + filtering.
 */

(function () {
  'use strict';

  // ── State ──
  let allCards = [];
  let collections = [];
  let filteredCards = [];
  let currentFilter = 'all';
  let currentSeries = 'all';
  let currentSort = 'number';
  let lightboxIndex = -1;

  // Collection prefix map (built from manifest)
  let prefixMap = {}; // seriesId → prefix

  // ── Elements ──
  const gallery = document.getElementById('gallery');
  const loading = document.getElementById('loading');
  const emptyState = document.getElementById('empty-state');
  const cardCount = document.getElementById('card-count');
  const heroCardCount = document.getElementById('hero-card-count');
  const heroSeriesCount = document.getElementById('hero-series-count');
  const heroImageCount = document.getElementById('hero-image-count');
  const sortSelect = document.getElementById('sort-select');
  const seriesGroup = document.getElementById('series-group');
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxName = document.getElementById('lightbox-name');
  const lightboxAka = document.getElementById('lightbox-aka');
  const lightboxNumber = document.getElementById('lightbox-number');
  const featuredGrid = document.getElementById('featured-grid');
  const heroCards = document.getElementById('hero-cards');

  // Stats
  const statTotal = document.getElementById('stat-total');
  const statGenerated = document.getElementById('stat-generated');
  const statFramed = document.getElementById('stat-framed');
  const statPending = document.getElementById('stat-pending');

  // ── Load Data ──
  async function loadManifest() {
    let manifest = null;

    try {
      const resp = await fetch('manifest.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      manifest = await resp.json();
      allCards = manifest.cards || [];
      collections = manifest.collections || [];

      // Build prefix map
      for (const col of collections) {
        prefixMap[col.id] = col.prefix;
      }
    } catch (e) {
      console.warn('No manifest.json found:', e);
      allCards = [];
    }

    return manifest;
  }

  // ── Get card display number ──
  function getCardLabel(card) {
    const sid = card.seriesId || 'sa';
    const prefix = prefixMap[sid] || sid.toUpperCase();
    const num = String(card.number).padStart(2, '0');
    const variant = card.variant ? card.variant.toUpperCase() : '';
    return `${prefix}-${num}${variant}`;
  }

  // ── Get series name ──
  function getSeriesName(seriesId) {
    const col = collections.find(c => c.id === seriesId);
    return col ? col.name : seriesId;
  }

  // ── Render Series Buttons ──
  function renderSeriesButtons() {
    if (!seriesGroup) return;

    // Find which series have cards
    const seriesWithCards = new Set(allCards.map(c => c.seriesId || 'sa'));

    // Clear existing buttons except "All"
    seriesGroup.innerHTML = '<button class="series-btn active" data-series="all">All Series</button>';

    for (const col of collections) {
      if (!seriesWithCards.has(col.id)) continue;
      const count = allCards.filter(c => (c.seriesId || 'sa') === col.id).length;
      const btn = document.createElement('button');
      btn.className = 'series-btn';
      btn.dataset.series = col.id;
      btn.textContent = `${col.name} (${count})`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSeries = col.id;
        render();
      });
      seriesGroup.appendChild(btn);
    }

    // Re-bind "All" button
    seriesGroup.querySelector('[data-series="all"]').addEventListener('click', (e) => {
      document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentSeries = 'all';
      render();
    });
  }

  // ── Render ──
  function render() {
    // Apply series filter
    let cards = allCards;
    if (currentSeries !== 'all') {
      cards = cards.filter(c => (c.seriesId || 'sa') === currentSeries);
    }

    // Apply image filter
    filteredCards = cards.filter(c => {
      if (currentFilter === 'framed') return c.framed;
      if (currentFilter === 'raw') return c.raw && !c.framed;
      return true;
    });

    // Apply sort
    filteredCards.sort((a, b) => {
      if (currentSort === 'name') return a.name.localeCompare(b.name);
      // Sort by series order, then number, then variant
      const aSeriesIdx = collections.findIndex(c => c.id === (a.seriesId || 'sa'));
      const bSeriesIdx = collections.findIndex(c => c.id === (b.seriesId || 'sa'));
      if (aSeriesIdx !== bSeriesIdx) return aSeriesIdx - bSeriesIdx;
      return a.number - b.number || (a.variant || '').localeCompare(b.variant || '');
    });

    // Clear gallery
    gallery.innerHTML = '';

    if (filteredCards.length === 0) {
      emptyState.hidden = false;
      gallery.style.display = 'none';
    } else {
      emptyState.hidden = true;
      gallery.style.display = '';

      filteredCards.forEach((card, index) => {
        const el = createCardElement(card, index);
        gallery.appendChild(el);
      });
    }

    // Count
    const imageCount = allCards.filter(c => c.raw || c.framed).length;
    cardCount.textContent = `${filteredCards.length} card${filteredCards.length !== 1 ? 's' : ''}`;
    if (heroCardCount) heroCardCount.textContent = allCards.length;
    if (heroImageCount) heroImageCount.textContent = imageCount;

    // Stats
    updateStats();
  }

  function createCardElement(card, index) {
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.index = index;

    const imgSrc = card.framed || card.raw;
    const seriesId = card.seriesId || 'sa';

    // Image wrapper
    const imgWrap = document.createElement('div');
    imgWrap.className = 'card-image';

    if (imgSrc) {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = card.name;
      img.loading = 'lazy';
      imgWrap.appendChild(img);
    } else {
      imgWrap.innerHTML = `
        <div class="card-placeholder">
          <div style="font-size:3rem;margin-bottom:0.5rem;">🎴</div>
          <div style="font-family:'Bangers',cursive;font-size:1.2rem;color:#e85d3a;">${card.name}</div>
          <div style="margin-top:0.3rem;font-size:0.7rem;color:#555;">Pending Generation</div>
        </div>`;
    }
    div.appendChild(imgWrap);

    // Card info
    const info = document.createElement('div');
    info.className = 'card-info';
    const label = getCardLabel(card);
    const seriesName = getSeriesName(seriesId);
    info.innerHTML = `
      <h3 class="card-name">${card.name}</h3>
      <div class="card-meta">
        <span class="card-number">${label}</span>
        ${card.other_name ? `<span class="card-aka">a.k.a. "${card.other_name}"</span>` : ''}
      </div>
      <div class="card-credit">${seriesName} &bull; Made by Ryan &amp; HoWell AI</div>`;
    div.appendChild(info);

    // Click handler
    if (imgSrc) {
      div.addEventListener('click', () => openLightbox(index));
    }

    return div;
  }

  function renderFeatured() {
    if (!featuredGrid) return;
    // Show first 4 cards that have images, spread across series
    const seen = new Set();
    const featured = [];
    for (const card of allCards) {
      if (!(card.raw || card.framed)) continue;
      const sid = card.seriesId || 'sa';
      if (!seen.has(sid)) {
        featured.push(card);
        seen.add(sid);
      }
      if (featured.length >= 4) break;
    }
    // Fill remaining with any images
    if (featured.length < 4) {
      for (const card of allCards) {
        if (featured.length >= 4) break;
        if (!(card.raw || card.framed)) continue;
        if (!featured.includes(card)) featured.push(card);
      }
    }

    featuredGrid.innerHTML = '';

    if (featured.length === 0) {
      featuredGrid.parentElement.style.display = 'none';
      return;
    }

    featured.forEach(card => {
      const div = document.createElement('div');
      div.className = 'featured-card';
      const seriesName = getSeriesName(card.seriesId || 'sa');
      div.innerHTML = `
        <img src="${card.raw}" alt="${card.name}" loading="lazy">
        <div class="badge">#${card.number}</div>
        <div class="card-label">
          <h3>${card.name}</h3>
          <p>${card.other_name ? `a.k.a. "${card.other_name}"` : seriesName}</p>
        </div>`;
      div.addEventListener('click', () => {
        const idx = filteredCards.findIndex(c => c.number === card.number && c.variant === card.variant && c.seriesId === card.seriesId);
        if (idx >= 0) openLightbox(idx);
      });
      featuredGrid.appendChild(div);
    });
  }

  function renderHeroCards() {
    if (!heroCards) return;
    const withImages = allCards.filter(c => c.raw || c.framed).slice(0, 3);
    heroCards.innerHTML = '';

    withImages.forEach(card => {
      const div = document.createElement('div');
      div.className = 'hero-float-card';
      div.innerHTML = `<img src="${card.raw}" alt="${card.name}">`;
      heroCards.appendChild(div);
    });
  }

  function updateStats() {
    if (statTotal) statTotal.textContent = allCards.length;
    if (statGenerated) statGenerated.textContent = allCards.filter(c => c.raw).length;
    if (statFramed) statFramed.textContent = allCards.filter(c => c.framed).length;
    if (statPending) statPending.textContent = allCards.filter(c => !c.raw && !c.framed).length;
    if (heroSeriesCount) heroSeriesCount.textContent = collections.length;
  }

  // ── Lightbox ──
  function openLightbox(index) {
    const card = filteredCards[index];
    if (!card) return;

    lightboxIndex = index;
    lightboxImg.src = card.framed || card.raw;
    lightboxName.textContent = card.name;
    lightboxAka.textContent = card.other_name ? `a.k.a. "${card.other_name}"` : '';
    const label = getCardLabel(card);
    const seriesName = getSeriesName(card.seriesId || 'sa');
    lightboxNumber.textContent = `${label} • ${seriesName}`;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    lightboxIndex = -1;
  }

  function navLightbox(dir) {
    const hasImage = c => c.raw || c.framed;
    let next = lightboxIndex + dir;
    while (next >= 0 && next < filteredCards.length && !hasImage(filteredCards[next])) {
      next += dir;
    }
    if (next >= 0 && next < filteredCards.length && hasImage(filteredCards[next])) {
      openLightbox(next);
    }
  }

  // ── Events ──
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    render();
  });

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', () => navLightbox(-1));
  document.getElementById('lightbox-next').addEventListener('click', () => navLightbox(1));

  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Init ──
  async function init() {
    const data = await loadManifest();
    if (loading) loading.remove();

    renderSeriesButtons();
    render();
    renderFeatured();
    renderHeroCards();
  }

  init();
})();
