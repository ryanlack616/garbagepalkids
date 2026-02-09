/**
 * GarbagePal Kids — Suggestions Page
 * Browse / filter / favorite 500 card concepts.
 * Voting via Supabase, favorites stored in localStorage.
 */
(function () {
  'use strict';

  // ── Supabase config ──
  // Replace these with your project values after running supabase_schema.sql
  const SUPABASE_URL = 'https://ljptakdlbbyhvhzpaxka.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_TbBVqpLaXCWCUbau91_cng_y-YawByf';
  let supabase = null;
  let votingEnabled = false;

  // ── Voting state ──
  let voteTallies = {};          // { suggestion_id: { up: N, down: N, score: N } }
  let myVotes = {};              // { suggestion_id: 1 or -1 }
  let fingerprint = '';          // anonymous browser fingerprint

  function initSupabase() {
    if (SUPABASE_URL.includes('YOUR_PROJECT')) {
      console.log('Voting disabled: Supabase not configured');
      return;
    }
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      votingEnabled = true;
      console.log('Voting enabled');
    } catch (e) {
      console.warn('Supabase init failed:', e);
    }
  }

  // Simple browser fingerprint (no PII, no IP)
  async function generateFingerprint() {
    const raw = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.hardwareConcurrency || 0,
    ].join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadVoteTallies() {
    if (!votingEnabled) return;
    try {
      const { data, error } = await supabase.from('gpk_vote_tallies').select('*');
      if (error) throw error;
      voteTallies = {};
      (data || []).forEach(row => {
        voteTallies[row.suggestion_id] = {
          up: row.upvotes || 0,
          down: row.downvotes || 0,
          score: row.score || 0,
        };
      });
    } catch (e) {
      console.warn('Failed to load vote tallies:', e);
    }
  }

  async function loadMyVotes() {
    if (!votingEnabled) return;
    try {
      const { data, error } = await supabase
        .from('gpk_votes')
        .select('suggestion_id, vote')
        .eq('fingerprint', fingerprint);
      if (error) throw error;
      myVotes = {};
      (data || []).forEach(row => {
        myVotes[row.suggestion_id] = row.vote;
      });
    } catch (e) {
      console.warn('Failed to load my votes:', e);
    }
  }

  async function castVote(suggestionId, vote) {
    if (!votingEnabled) return;
    const existing = myVotes[suggestionId];

    try {
      if (existing === vote) {
        // Undo vote
        const { error } = await supabase
          .from('gpk_votes')
          .delete()
          .eq('suggestion_id', suggestionId)
          .eq('fingerprint', fingerprint);
        if (error) throw error;
        delete myVotes[suggestionId];
        // Update local tally
        if (voteTallies[suggestionId]) {
          if (vote === 1) voteTallies[suggestionId].up--;
          else voteTallies[suggestionId].down--;
          voteTallies[suggestionId].score -= vote;
        }
      } else if (existing) {
        // Change vote direction
        const { error } = await supabase
          .from('gpk_votes')
          .update({ vote })
          .eq('suggestion_id', suggestionId)
          .eq('fingerprint', fingerprint);
        if (error) throw error;
        myVotes[suggestionId] = vote;
        if (voteTallies[suggestionId]) {
          if (vote === 1) { voteTallies[suggestionId].up++; voteTallies[suggestionId].down--; }
          else { voteTallies[suggestionId].up--; voteTallies[suggestionId].down++; }
          voteTallies[suggestionId].score += vote * 2;
        }
      } else {
        // New vote
        const { error } = await supabase
          .from('gpk_votes')
          .insert({ suggestion_id: suggestionId, fingerprint, vote });
        if (error) throw error;
        myVotes[suggestionId] = vote;
        if (!voteTallies[suggestionId]) voteTallies[suggestionId] = { up: 0, down: 0, score: 0 };
        if (vote === 1) voteTallies[suggestionId].up++;
        else voteTallies[suggestionId].down++;
        voteTallies[suggestionId].score += vote;
      }
    } catch (e) {
      console.error('Vote failed:', e);
    }
  }

  function getScore(id) {
    return (voteTallies[id] && voteTallies[id].score) || 0;
  }

  // ── Series metadata ──
  const SERIES_META = {
    'Suburban Apocalypse': {
      emoji: '🏚️',
      color: '#2dce89',
      desc: 'The end of the world, HOA-approved. Everyday suburbia becomes slow, disgusting collapse: paperwork, lawns, basements, and polite panic.'
    },
    'Influencer Wasteland': {
      emoji: '📱',
      color: '#f5365c',
      desc: 'Fame as toxic waste. Bodies mutate around metrics, sponsorships attach to organs, and personalities hollow into UI components.'
    },
    'TikTok Terrors': {
      emoji: '🎵',
      color: '#fb6340',
      desc: 'Trends as traps. Filters erase faces, loops lock bodies, and viral sounds restructure skeletons.'
    },
    'Reality Ruination': {
      emoji: '📺',
      color: '#ffd832',
      desc: 'Nothing is scripted; everything is cruel. Eliminations, confessionals, edits and scoreboards become literal mechanisms of harm.'
    },
    'Hollywood Has-Beens': {
      emoji: '🎬',
      color: '#11cdef',
      desc: 'The reboot never stops. Green screens, makeup rot, and nostalgia parasites recycle identity until it fails.'
    },
    'Horror Classics Parodies': {
      emoji: '🔪',
      color: '#8b5cf6',
      desc: 'Classic horror meets modern inconvenience: compliance monsters, subscription jump scares, haunted paperwork.'
    },
    'Sci-Fi Future Misfits': {
      emoji: '🚀',
      color: '#06b6d4',
      desc: 'The future optimizes humans incorrectly. Patches, protocols, and "helpful" systems turn bodies into error states.'
    },
    'Election Trash Talk': {
      emoji: '🗳️',
      color: '#ef4444',
      desc: 'Power as performance. Polls, debates, and media cycles become physical burdens and grotesque theater.'
    },
    'Mythical Mayhem': {
      emoji: '⚡',
      color: '#eab308',
      desc: 'Ancient gods meet modern systems. Oracles become apps, hydras become interest, and curses arrive by certified mail.'
    },
    'Cabbage Patch Rejects': {
      emoji: '🧸',
      color: '#ec4899',
      desc: 'Mass-produced innocence breaks. Dolls malfunction, recalls become spells, and soft materials develop teeth.'
    },
    'Monster Mash-Up': {
      emoji: '👹',
      color: '#a855f7',
      desc: 'Hybrid monsters fail loudly. Transformations stall, parts reject each other, and curses overlap into sludge.'
    }
  };

  // ── State ──
  let allSuggestions = [];
  let filtered = [];
  let favorites = new Set(JSON.parse(localStorage.getItem('gpk_favorites') || '[]'));
  let currentFilter = 'all';
  let currentSeries = 'all';
  let currentSort = 'series';
  let currentSearch = '';
  let currentPage = 1;
  const PER_PAGE = 24;

  // ── Elements ──
  const grid = document.getElementById('suggestion-grid');
  const loading = document.getElementById('loading');
  const pagination = document.getElementById('pagination');
  const resultCount = document.getElementById('result-count');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const seriesSelect = document.getElementById('series-select');
  const seriesGrid = document.getElementById('series-grid');
  const heroTotal = document.getElementById('hero-total');
  const heroSeries = document.getElementById('hero-series');
  const heroFaves = document.getElementById('hero-faves');
  const exportSection = document.getElementById('export-section');
  const exportSummary = document.getElementById('export-summary');
  const copyBtn = document.getElementById('copy-picks-btn');
  const clearBtn = document.getElementById('clear-picks-btn');

  // ── Load ──
  async function loadSuggestions() {
    try {
      const resp = await fetch('suggestions.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      allSuggestions = data.suggestions || [];
    } catch (e) {
      console.error('Failed to load suggestions:', e);
      allSuggestions = [];
    }
  }

  // ── Favorites ──
  function saveFavorites() {
    localStorage.setItem('gpk_favorites', JSON.stringify([...favorites]));
    updateFaveCount();
    updateExportSection();
  }

  function toggleFavorite(id) {
    if (favorites.has(id)) {
      favorites.delete(id);
    } else {
      favorites.add(id);
    }
    saveFavorites();
  }

  function updateFaveCount() {
    if (heroFaves) heroFaves.textContent = favorites.size;
  }

  // ── Series nav (dropdown) ──
  function renderSeriesNav() {
    const seriesList = [...new Set(allSuggestions.map(s => s.series))];
    const select = document.getElementById('series-select');

    // Clear existing options (keep "All")
    select.innerHTML = '<option value="all">All Series</option>';

    seriesList.forEach(name => {
      const meta = SERIES_META[name] || { emoji: '🃏', color: '#e85d3a' };
      const count = allSuggestions.filter(s => s.series === name).length;
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${meta.emoji} ${name} (${count})`;
      select.appendChild(opt);
    });

    select.addEventListener('change', () => {
      currentSeries = select.value;
      currentPage = 1;
      render();
      scrollToControls();
    });
  }

  // ── Series info cards ──
  function renderSeriesInfo() {
    if (!seriesGrid) return;
    const seriesList = [...new Set(allSuggestions.map(s => s.series))];

    seriesGrid.innerHTML = seriesList.map(name => {
      const meta = SERIES_META[name] || { emoji: '🃏', color: '#e85d3a', desc: '' };
      const count = allSuggestions.filter(s => s.series === name).length;
      return `
        <div class="series-info-card" style="--card-accent: ${meta.color}">
          <div class="series-info-emoji">${meta.emoji}</div>
          <h3>${name}</h3>
          <p class="series-info-count">${count} suggestions</p>
          <p class="series-info-desc">${meta.desc}</p>
          <button class="btn btn-sm" data-browse="${name}">Browse →</button>
        </div>`;
    }).join('');

    // Bind browse buttons
    seriesGrid.querySelectorAll('[data-browse]').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.browse;
        currentSeries = name;
        currentPage = 1;
        if (seriesSelect) seriesSelect.value = name;
        render();
        scrollToControls();
      });
    });
  }

  // ── Filter + Sort ──
  function applyFilters() {
    let list = [...allSuggestions];

    // Series
    if (currentSeries !== 'all') {
      list = list.filter(s => s.series === currentSeries);
    }

    // Filter pill
    if (currentFilter === 'favorites') {
      list = list.filter(s => favorites.has(s.id));
    } else if (currentFilter === 'safe') {
      list = list.filter(s => s.distance === 'safe');
    } else if (currentFilter === 'spicy') {
      list = list.filter(s => s.distance === 'spicy');
    }

    // Search
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.pitch.toLowerCase().includes(q) ||
        s.series.toLowerCase().includes(q) ||
        (s.name_a && s.name_a.toLowerCase().includes(q)) ||
        (s.name_b && s.name_b.toLowerCase().includes(q)) ||
        (s.tone_tags && s.tone_tags.some(t => t.includes(q)))
      );
    }

    // Sort
    if (currentSort === 'title') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentSort === 'favorites-first') {
      list.sort((a, b) => {
        const af = favorites.has(a.id) ? 0 : 1;
        const bf = favorites.has(b.id) ? 0 : 1;
        if (af !== bf) return af - bf;
        return a.series.localeCompare(b.series) || a.title.localeCompare(b.title);
      });
    } else if (currentSort === 'votes') {
      list.sort((a, b) => {
        const sa = getScore(a.id);
        const sb = getScore(b.id);
        if (sb !== sa) return sb - sa;  // highest first
        return a.title.localeCompare(b.title);
      });
    } else {
      // by series (default)
      const seriesOrder = [...new Set(allSuggestions.map(s => s.series))];
      list.sort((a, b) => {
        const ai = seriesOrder.indexOf(a.series);
        const bi = seriesOrder.indexOf(b.series);
        if (ai !== bi) return ai - bi;
        return a.title.localeCompare(b.title);
      });
    }

    filtered = list;
  }

  // ── Render ──
  function render() {
    applyFilters();

    const totalPages = Math.ceil(filtered.length / PER_PAGE);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const start = (currentPage - 1) * PER_PAGE;
    const page = filtered.slice(start, start + PER_PAGE);

    grid.innerHTML = '';

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🃏</div>
          <h3>No suggestions found</h3>
          <p>${currentFilter === 'favorites' ? 'Heart some cards to see them here!' : 'Try a different search or filter.'}</p>
        </div>`;
    } else {
      page.forEach(s => {
        grid.appendChild(createSuggestionCard(s));
      });
    }

    // Count
    resultCount.textContent = `${filtered.length} suggestion${filtered.length !== 1 ? 's' : ''}${totalPages > 1 ? ` · Page ${currentPage}/${totalPages}` : ''}`;

    renderPagination(totalPages);
  }

  function createSuggestionCard(s) {
    const div = document.createElement('div');
    const meta = SERIES_META[s.series] || { emoji: '🃏', color: '#e85d3a' };
    const isFav = favorites.has(s.id);
    const score = getScore(s.id);
    const myVote = myVotes[s.id] || 0;

    div.className = 'suggestion-card' + (isFav ? ' favorited' : '') + (s.distance === 'spicy' ? ' spicy' : '');
    div.style.setProperty('--card-accent', meta.color);

    const nameA = s.name_a || s.title;
    const nameB = s.name_b || '';

    div.innerHTML = `
      <div class="sug-header">
        <span class="sug-series-badge" style="background: ${meta.color}20; color: ${meta.color}; border-color: ${meta.color}40">${meta.emoji} ${s.series}</span>
        ${s.distance === 'spicy' ? '<span class="sug-spicy-badge">🌶️</span>' : ''}
        <button class="sug-fav-btn ${isFav ? 'active' : ''}" data-id="${s.id}" title="${isFav ? 'Remove from picks' : 'Add to picks'}">
          ${isFav ? '♥' : '♡'}
        </button>
      </div>
      <div class="sug-names">
        <span class="sug-name-a">${nameA}</span>
        ${nameB ? `<span class="sug-name-divider">/</span><span class="sug-name-b">${nameB}</span>` : ''}
      </div>
      <p class="sug-concept">${s.title}</p>
      <p class="sug-pitch">${s.pitch}</p>
      <div class="sug-tags">${(s.tone_tags || []).slice(0, 4).map(t => `<span class="sug-tag">${t}</span>`).join('')}</div>
      ${votingEnabled ? `
      <div class="sug-votes">
        <button class="vote-btn vote-up ${myVote === 1 ? 'active' : ''}" data-id="${s.id}" data-dir="1" title="Upvote">
          <span class="vote-arrow">▲</span>
        </button>
        <span class="vote-score ${score > 0 ? 'positive' : score < 0 ? 'negative' : ''}">${score}</span>
        <button class="vote-btn vote-down ${myVote === -1 ? 'active' : ''}" data-id="${s.id}" data-dir="-1" title="Downvote">
          <span class="vote-arrow">▼</span>
        </button>
      </div>` : ''}
    `;

    // Fav button
    const favBtn = div.querySelector('.sug-fav-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(s.id);
      const nowFav = favorites.has(s.id);
      favBtn.classList.toggle('active', nowFav);
      favBtn.innerHTML = nowFav ? '♥' : '♡';
      favBtn.title = nowFav ? 'Remove from picks' : 'Add to picks';
      div.classList.toggle('favorited', nowFav);

      // Animate
      if (nowFav) {
        favBtn.classList.add('pulse');
        setTimeout(() => favBtn.classList.remove('pulse'), 400);
      }
    });

    // Vote buttons
    if (votingEnabled) {
      div.querySelectorAll('.vote-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const dir = parseInt(btn.dataset.dir);
          await castVote(s.id, dir);
          // Re-render this card's vote state
          const scoreEl = div.querySelector('.vote-score');
          const newScore = getScore(s.id);
          const newVote = myVotes[s.id] || 0;
          scoreEl.textContent = newScore;
          scoreEl.className = 'vote-score ' + (newScore > 0 ? 'positive' : newScore < 0 ? 'negative' : '');
          div.querySelectorAll('.vote-btn').forEach(b => {
            const d = parseInt(b.dataset.dir);
            b.classList.toggle('active', d === newVote);
          });
        });
      });
    }

    return div;
  }

  // ── Pagination ──
  function renderPagination(totalPages) {
    pagination.innerHTML = '';
    if (totalPages <= 1) { pagination.hidden = true; return; }
    pagination.hidden = false;

    const prev = document.createElement('button');
    prev.className = 'page-btn' + (currentPage === 1 ? ' disabled' : '');
    prev.textContent = '‹ Prev';
    prev.disabled = currentPage === 1;
    prev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; render(); scrollToControls(); } });
    pagination.appendChild(prev);

    const pages = buildPageNumbers(currentPage, totalPages);
    pages.forEach(p => {
      if (p === '...') {
        const dots = document.createElement('span');
        dots.className = 'page-dots';
        dots.textContent = '...';
        pagination.appendChild(dots);
      } else {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
        btn.textContent = p;
        btn.addEventListener('click', () => { currentPage = p; render(); scrollToControls(); });
        pagination.appendChild(btn);
      }
    });

    const next = document.createElement('button');
    next.className = 'page-btn' + (currentPage === totalPages ? ' disabled' : '');
    next.textContent = 'Next ›';
    next.disabled = currentPage === totalPages;
    next.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; render(); scrollToControls(); } });
    pagination.appendChild(next);
  }

  function buildPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  function scrollToControls() {
    const el = document.getElementById('controls');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Export section ──
  function updateExportSection() {
    if (!exportSection) return;

    if (favorites.size > 0) {
      exportSection.hidden = false;
      const faveList = allSuggestions.filter(s => favorites.has(s.id));
      const bySeries = {};
      faveList.forEach(s => {
        if (!bySeries[s.series]) bySeries[s.series] = [];
        bySeries[s.series].push(s.title);
      });

      let text = `${favorites.size} picks across ${Object.keys(bySeries).length} series:\n`;
      for (const [series, titles] of Object.entries(bySeries)) {
        text += `\n${series}: ${titles.join(', ')}`;
      }
      exportSummary.textContent = `${favorites.size} pick${favorites.size !== 1 ? 's' : ''} across ${Object.keys(bySeries).length} series`;
    } else {
      exportSection.hidden = true;
    }
  }

  // ── Events ──
  // Filter pills
  document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      currentPage = 1;
      render();
    });
  });

  // Sort
  sortSelect.addEventListener('change', () => {
    currentSort = sortSelect.value;
    currentPage = 1;
    render();
  });

  // Search
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearch = searchInput.value.trim();
      currentPage = 1;
      render();
    }, 200);
  });

  // Copy picks
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const faveList = allSuggestions.filter(s => favorites.has(s.id));
      const bySeries = {};
      faveList.forEach(s => {
        if (!bySeries[s.series]) bySeries[s.series] = [];
        bySeries[s.series].push(s);
      });

      let text = `My GarbagePal Kids Picks (${favorites.size}):\n`;
      for (const [series, cards] of Object.entries(bySeries)) {
        text += `\n${series}:\n${cards.map(c => `  • ${c.name_a || c.title} / ${c.name_b || c.title}`).join('\n')}`;
      }
      text += '\n\nhttps://garbagepalkids.lol/suggest.html';

      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = '📋 Copy List'; }, 2000);
      });
    });
  }

  // Clear picks
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!confirm('Clear all your picks?')) return;
      favorites.clear();
      saveFavorites();
      render();
    });
  }

  // ── Init ──
  async function init() {
    // Init voting
    initSupabase();
    fingerprint = await generateFingerprint();

    await loadSuggestions();
    if (loading) loading.remove();

    // Load votes in parallel
    if (votingEnabled) {
      await Promise.all([loadVoteTallies(), loadMyVotes()]);
    }

    // Hero stats
    if (heroTotal) heroTotal.textContent = allSuggestions.length;
    const seriesList = [...new Set(allSuggestions.map(s => s.series))];
    if (heroSeries) heroSeries.textContent = seriesList.length;
    updateFaveCount();

    renderSeriesNav();
    renderSeriesInfo();
    updateExportSection();
    render();
  }

  init();
})();
