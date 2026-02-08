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
  let currentSearch = '';
  let lightboxIndex = -1;
  let currentPage = 1;
  const CARDS_PER_PAGE = 12;

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
  const lightboxDesc = document.getElementById('lightbox-desc');
  const featuredGrid = document.getElementById('featured-grid');
  const heroCards = document.getElementById('hero-cards');

  // Stats
  const statTotal = document.getElementById('stat-total');
  const statGenerated = document.getElementById('stat-generated');
  const statFramed = document.getElementById('stat-framed');
  const statPending = document.getElementById('stat-pending');

  // Search
  const searchInput = document.getElementById('search-input');

  // Random
  const randomBtn = document.getElementById('random-btn');

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
        currentPage = 1;
        render();
      });
      seriesGroup.appendChild(btn);
    }

    // Re-bind "All" button
    seriesGroup.querySelector('[data-series="all"]').addEventListener('click', (e) => {
      document.querySelectorAll('.series-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentSeries = 'all';
      currentPage = 1;
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

    // Apply search filter
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      cards = cards.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.other_name && c.other_name.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
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

    // Pagination
    const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const startIdx = (currentPage - 1) * CARDS_PER_PAGE;
    const pageCards = filteredCards.slice(startIdx, startIdx + CARDS_PER_PAGE);

    // Clear gallery
    gallery.innerHTML = '';

    if (filteredCards.length === 0) {
      emptyState.hidden = false;
      gallery.style.display = 'none';
      renderPagination(0);
    } else {
      emptyState.hidden = true;
      gallery.style.display = '';

      pageCards.forEach((card, index) => {
        const el = createCardElement(card, startIdx + index);
        gallery.appendChild(el);
      });
      renderPagination(totalPages);
    }

    // Count
    const imageCount = allCards.filter(c => c.raw || c.framed).length;
    cardCount.textContent = `${filteredCards.length} card${filteredCards.length !== 1 ? 's' : ''} · Page ${currentPage}/${totalPages || 1}`;
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

    // Check for A/B pair
    const pairCard = findVariantPair(card);
    const flipHtml = pairCard ? `<button class="flip-btn" title="Show ${pairCard.variant.toUpperCase()} variant">\u21C4 ${pairCard.name}</button>` : '';

    info.innerHTML = `
      <h3 class="card-name">${card.name}</h3>
      <div class="card-meta">
        <span class="card-number">${label}</span>
        ${card.other_name ? `<span class="card-aka">a.k.a. "${card.other_name}"</span>` : ''}
        ${flipHtml}
      </div>
      <div class="card-credit">${seriesName}</div>
      ${card.description ? `<p class="card-desc">${card.description}</p>` : ''}`;
    div.appendChild(info);

    // Flip button handler
    const flipBtn = info.querySelector('.flip-btn');
    if (flipBtn && pairCard) {
      flipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pairIdx = filteredCards.indexOf(pairCard);
        if (pairIdx >= 0) openLightbox(pairIdx);
        else {
          // Card may be on another page — find in allCards
          const globalIdx = allCards.indexOf(pairCard);
          if (globalIdx >= 0) {
            openLightboxDirect(pairCard);
          }
        }
      });
    }

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
      const imgSrc = card.framed || card.raw;
      div.innerHTML = `
        <img src="${imgSrc}" alt="${card.name}" loading="lazy">
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
      const imgSrc = card.framed || card.raw;
      div.innerHTML = `<img src="${imgSrc}" alt="${card.name}">`;
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

  // ── Variant Pair Lookup ──
  function findVariantPair(card) {
    if (!card.variant) return null;
    const otherVariant = card.variant === 'a' ? 'b' : 'a';
    return allCards.find(c =>
      c.seriesId === card.seriesId &&
      c.number === card.number &&
      c.variant === otherVariant
    ) || null;
  }

  // ── Pagination ──
  function renderPagination(totalPages) {
    let pag = document.getElementById('pagination');
    if (!pag) {
      pag = document.createElement('div');
      pag.id = 'pagination';
      pag.className = 'pagination';
      gallery.parentNode.appendChild(pag);
    }
    pag.innerHTML = '';
    if (totalPages <= 1) { pag.hidden = true; return; }
    pag.hidden = false;

    // Prev
    const prev = document.createElement('button');
    prev.className = 'page-btn' + (currentPage === 1 ? ' disabled' : '');
    prev.textContent = '\u2039 Prev';
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; render(); scrollToCollection(); } });
    pag.appendChild(prev);

    // Page numbers
    const pages = buildPageNumbers(currentPage, totalPages);
    pages.forEach(p => {
      if (p === '...') {
        const dots = document.createElement('span');
        dots.className = 'page-dots';
        dots.textContent = '...';
        pag.appendChild(dots);
      } else {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => { currentPage = p; render(); scrollToCollection(); });
        pag.appendChild(btn);
      }
    });

    // Next
    const next = document.createElement('button');
    next.className = 'page-btn' + (currentPage === totalPages ? ' disabled' : '');
    next.textContent = 'Next \u203A';
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; render(); scrollToCollection(); } });
    pag.appendChild(next);
  }

  function buildPageNumbers(current, total) {
    if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  function scrollToCollection() {
    const el = document.getElementById('collection');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Lightbox ──
  function showCardInLightbox(card, index) {
    lightboxIndex = index;
    lightboxImg.src = card.framed || card.raw;
    lightboxName.textContent = card.name;
    lightboxAka.textContent = card.other_name ? `a.k.a. "${card.other_name}"` : '';
    const label = getCardLabel(card);
    const seriesName = getSeriesName(card.seriesId || 'sa');
    lightboxNumber.textContent = `${label} • ${seriesName}`;
    if (lightboxDesc) lightboxDesc.textContent = card.description || '';

    // Download button
    const dlBtn = document.getElementById('lightbox-download');
    if (dlBtn) {
      dlBtn.onclick = () => downloadCard(card);
    }

    // Flip button in lightbox
    const lbFlip = document.getElementById('lightbox-flip');
    const pair = findVariantPair(card);
    if (lbFlip) {
      if (pair && (pair.raw || pair.framed)) {
        lbFlip.hidden = false;
        lbFlip.textContent = `\u21C4 ${pair.name}`;
        lbFlip.onclick = () => {
          const pairIdx = filteredCards.indexOf(pair);
          if (pairIdx >= 0) showCardInLightbox(pair, pairIdx);
          else showCardInLightbox(pair, -1);
          updateHash(pair);
        };
      } else {
        lbFlip.hidden = true;
      }
    }

    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    updateHash(card);
  }

  function openLightbox(index) {
    const card = filteredCards[index];
    if (!card) return;
    showCardInLightbox(card, index);
  }

  function openLightboxDirect(card) {
    showCardInLightbox(card, -1);
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    lightboxIndex = -1;
    history.replaceState(null, '', window.location.pathname);
  }

  // ── Download ──
  function downloadCard(card) {
    const src = card.framed || card.raw;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = getCardLabel(card) + '_' + card.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── Hash Routing ──
  function updateHash(card) {
    const label = getCardLabel(card);
    history.replaceState(null, '', '#card/' + label);
  }

  function handleHashRoute() {
    const hash = window.location.hash;
    if (!hash.startsWith('#card/')) return false;
    const cardLabel = hash.replace('#card/', '').toUpperCase();
    // Parse label like SA-01A, PK-05A, etc.
    const card = allCards.find(c => getCardLabel(c).toUpperCase() === cardLabel);
    if (card && (card.raw || card.framed)) {
      openLightboxDirect(card);
      return true;
    }
    return false;
  }

  // ── Random Card ──
  function pullRandomPack() {
    const withImages = allCards.filter(c => c.raw || c.framed);
    if (withImages.length === 0) return;
    const card = withImages[Math.floor(Math.random() * withImages.length)];
    openLightboxDirect(card);
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
      currentPage = 1;
      render();
    });
  });

  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    currentPage = 1;
    render();
  });

  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', () => navLightbox(-1));
  document.getElementById('lightbox-next').addEventListener('click', () => navLightbox(1));

  // Search
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearch = searchInput.value.trim();
      currentPage = 1;
      render();
    });
  }

  // Random
  if (randomBtn) {
    randomBtn.addEventListener('click', (e) => {
      e.preventDefault();
      pullRandomPack();
    });
  }

  // Hash routing
  window.addEventListener('hashchange', () => handleHashRoute());

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
    renderPipeline();

    // Handle deep link
    handleHashRoute();
  }

  // ── Pipeline / Behind the Scenes ──
  function renderPipeline() {
    const section = document.getElementById('pipeline-content');
    if (!section) return;

    const saCards = allCards.filter(c => c.seriesId === 'sa');
    const otherCards = allCards.filter(c => c.seriesId !== 'sa');

    section.innerHTML = `
      <div class="pipeline-grid">
        <div class="pipeline-card">
          <div class="pipeline-icon">🧪</div>
          <h3>Model</h3>
          <p><strong>Flux Kontext Max</strong> by Black Forest Labs</p>
          <p class="pipeline-detail">848×1184px (5:7) • 30 steps • CFG 2.2</p>
        </div>
        <div class="pipeline-card">
          <div class="pipeline-icon">🎨</div>
          <h3>Style Lock</h3>
          <p>Painted grotesque trading-card artwork in the classic 1980s Garbage Pail Kids style. Cabbage Patch Kids doll face, airbrushed rendering, warm saturated palette.</p>
        </div>
        <div class="pipeline-card">
          <div class="pipeline-icon">🚫</div>
          <h3>Invariants</h3>
          <ul>
            <li>Single character only</li>
            <li>No readable text anywhere</li>
            <li>No realistic blood or injury</li>
            <li>No weapons — gross-out only</li>
            <li>Clean silhouette, portrait framing</li>
          </ul>
        </div>
        <div class="pipeline-card">
          <div class="pipeline-icon">🔧</div>
          <h3>Pipeline</h3>
          <ul>
            <li><strong>SA series:</strong> 5-sentence prompts → Flux API → ComfyUI composite framing</li>
            <li><strong>Other series:</strong> Character descriptions → Flux Kontext → raw art</li>
            <li>8 candidates per card, best selected</li>
          </ul>
        </div>
        <div class="pipeline-card">
          <div class="pipeline-icon">📊</div>
          <h3>Numbers</h3>
          <p><strong>${allCards.length}</strong> cards defined across <strong>${collections.length}</strong> series</p>
          <p><strong>${saCards.length}</strong> Suburban Apocalypse cards with A/B variants and composite frames</p>
          <p><strong>${otherCards.length}</strong> cards across punk, GWAR, comedy, bonus, and music series</p>
        </div>
        <div class="pipeline-card">
          <div class="pipeline-icon">🤖</div>
          <h3>Built By</h3>
          <p>Card concepts, prompts, and pipeline by <strong>Ryan</strong> &amp; <strong>Claude-Howell</strong> (AI collaborator). February 2026.</p>
          <p class="pipeline-detail">Autonomous generation via Howell Daemon queue system</p>
        </div>
      </div>`;
  }

  init();
})();
