class SearchAutocomplete {
  constructor() {
    this.searchInputs = Array.from(document.querySelectorAll('.search-input-target'));
    this.allBookmarks = [];
    this.currentEngine = this.getCurrentEngine();
    this.debounceTimer = null;
    this.requestToken = 0;
    this.remoteCache = new Map();
    this.MAX_CACHE_SIZE = 200;

    this.DEBOUNCE_DELAY = 250;
    this.MAX_LOCAL_SUGGESTIONS = 5;
    this.MAX_TOTAL_SUGGESTIONS = 10;

    this.init();
  }

  init() {
    if (this.searchInputs.length === 0) {
      return;
    }

    this.collectAllBookmarks();

    this.searchInputs.forEach((input, index) => {
      const wrapper = input.closest('.search-input-target-wrapper');
      if (!wrapper) {
        return;
      }

      const dropdown = wrapper.querySelector('.suggestion-dropdown');
      const list = wrapper.querySelector('.suggestion-list');

      if (!dropdown || !list) {
        console.error(`[SearchAutocomplete] Missing dropdown/list for input #${index}`);
        return;
      }

      input.addEventListener('input', () => {
        clearTimeout(this.debounceTimer);
        const keyword = input.value.trim();

        this.syncInputValues(input, input.value);

        if (!keyword) {
          this.hideSuggestions();
          return;
        }

        this.currentEngine = this.getCurrentEngine();
        this.debounceTimer = setTimeout(() => {
          this.fetchSuggestions(keyword, dropdown, list, this.currentEngine);
        }, this.DEBOUNCE_DELAY);
      });

      input.addEventListener('keydown', (event) => {
        if (dropdown.classList.contains('hidden')) {
          return;
        }

        const items = list.querySelectorAll('.suggestion-item');
        if (items.length === 0) {
          return;
        }

        const currentActive = list.querySelector('.suggestion-item.active');
        let currentIndex = currentActive ? Array.from(items).indexOf(currentActive) : -1;

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          currentIndex = (currentIndex + 1) % items.length;
          this.selectItem(items, currentIndex);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          currentIndex = (currentIndex - 1 + items.length) % items.length;
          this.selectItem(items, currentIndex);
          return;
        }

        if (event.key === 'Enter' && currentActive) {
          event.preventDefault();
          const value = currentActive.dataset.value || currentActive.textContent.trim();
          this.applySuggestion(input, value);
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          this.hideSuggestions();
        }
      });

      input.addEventListener('blur', () => {
        setTimeout(() => this.hideSuggestions(), 120);
      });

      list.addEventListener('click', (event) => {
        const item = event.target.closest('.suggestion-item');
        if (!item) {
          return;
        }
        const value = item.dataset.value || item.textContent.trim();
        this.applySuggestion(input, value);
      });

      list.addEventListener('mousemove', (event) => {
        const item = event.target.closest('.suggestion-item');
        if (!item) {
          return;
        }
        const items = list.querySelectorAll('.suggestion-item');
        const index = Array.from(items).indexOf(item);
        this.selectItem(items, index);
      });
    });

    document.querySelectorAll('.search-engine-option').forEach((option) => {
      option.addEventListener('click', () => {
        this.currentEngine = option.dataset.engine || 'local';
        this.hideSuggestions();
      });
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.search-input-target-wrapper')) {
        this.hideSuggestions();
      }
    });

    window.searchAutocomplete = this;
  }

  getCurrentEngine() {
    if (typeof window.currentSearchEngine === 'string' && window.currentSearchEngine) {
      return window.currentSearchEngine;
    }
    return localStorage.getItem('search_engine') || 'local';
  }

  hideSuggestions() {
    document.querySelectorAll('.suggestion-dropdown').forEach((dropdown) => {
      dropdown.classList.add('hidden');
    });
  }

  selectItem(items, index) {
    items.forEach((item) => item.classList.remove('active'));
    if (items[index]) {
      items[index].classList.add('active');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  syncInputValues(sourceInput, value) {
    this.searchInputs.forEach((input) => {
      if (input !== sourceInput) {
        input.value = value;
      }
    });
  }

  applySuggestion(activeInput, value) {
    if (!value) {
      return;
    }

    this.searchInputs.forEach((input) => {
      input.value = value;
    });
    this.hideSuggestions();

    if (this.getCurrentEngine() === 'local') {
      activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  collectAllBookmarks() {
    const fromGlobal = Array.isArray(window.IORI_SITES)
      ? window.IORI_SITES.map((site) => ({
          name: site?.name || '',
          catalog: site?.catelog_name || site?.catelog || '',
          desc: site?.desc || ''
        }))
      : [];

    if (fromGlobal.length > 0) {
      this.allBookmarks = fromGlobal;
      return;
    }

    const cards = document.querySelectorAll('.site-card');
    this.allBookmarks = Array.from(cards).map((card) => ({
      name: card.dataset.name || '',
      catalog: card.dataset.catalog || '',
      desc: card.dataset.desc || ''
    }));
  }

  generateLocalSuggestions(keyword) {
    if (!keyword) {
      return [];
    }

    const lowerKeyword = keyword.toLowerCase();
    const scored = [];

    this.allBookmarks.forEach((site) => {
      const name = String(site.name || '');
      const catalog = String(site.catalog || '');
      const desc = String(site.desc || '');
      if (!name) {
        return;
      }

      const lowerName = name.toLowerCase();
      let score = 0;

      if (lowerName === lowerKeyword) {
        score = 100;
      } else if (lowerName.startsWith(lowerKeyword)) {
        score = 90;
      } else if (lowerName.includes(lowerKeyword)) {
        score = 70;
      } else if (catalog.toLowerCase().includes(lowerKeyword)) {
        score = 40;
      } else if (desc.toLowerCase().includes(lowerKeyword)) {
        score = 20;
      }

      if (score > 0) {
        scored.push({ value: name, score });
      }
    });

    scored.sort((a, b) => b.score - a.score);
    const seen = new Set();
    const suggestions = [];

    for (const item of scored) {
      const key = item.value.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      suggestions.push(item.value);
      if (suggestions.length >= this.MAX_LOCAL_SUGGESTIONS) {
        break;
      }
    }

    return suggestions;
  }

  async fetchSuggestions(keyword, dropdown, list, engine) {
    const token = ++this.requestToken;
    const localSuggestions = this.generateLocalSuggestions(keyword);

    if (engine === 'local') {
      this.renderAndToggle(localSuggestions, dropdown, list);
      return;
    }

    const remoteSuggestions = await this.fetchRemoteSuggestions(keyword, engine);
    if (token !== this.requestToken) {
      return;
    }

    const merged = this.mergeSuggestions(localSuggestions, remoteSuggestions, this.MAX_TOTAL_SUGGESTIONS);
    this.renderAndToggle(merged, dropdown, list);
  }

  async fetchRemoteSuggestions(keyword, engine) {
    if (!keyword || !engine || engine === 'local') {
      return [];
    }

    const cacheKey = `${engine}:${keyword.toLowerCase()}`;
    if (this.remoteCache.has(cacheKey)) {
      return this.remoteCache.get(cacheKey);
    }

    try {
      const params = new URLSearchParams({
        q: keyword,
        engine
      });
      const response = await fetch(`/api/search/suggestions?${params.toString()}`, {
        headers: { Accept: 'application/json' }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const suggestions = Array.isArray(data?.suggestions)
        ? data.suggestions
            .map((item) => String(item || '').trim())
            .filter(Boolean)
            .slice(0, this.MAX_TOTAL_SUGGESTIONS)
        : [];

      if (this.remoteCache.size >= this.MAX_CACHE_SIZE) {
        const oldestKey = this.remoteCache.keys().next().value;
        if (oldestKey) {
          this.remoteCache.delete(oldestKey);
        }
      }
      this.remoteCache.set(cacheKey, suggestions);
      return suggestions;
    } catch (error) {
      console.warn('[SearchAutocomplete] Failed to load remote suggestions:', error);
      return [];
    }
  }

  mergeSuggestions(localSuggestions, remoteSuggestions, maxCount) {
    const merged = [];
    const seen = new Set();
    const all = [...localSuggestions, ...remoteSuggestions];

    for (const item of all) {
      const value = String(item || '').trim();
      if (!value) {
        continue;
      }
      const key = value.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(value);
      if (merged.length >= maxCount) {
        break;
      }
    }

    return merged;
  }

  renderAndToggle(suggestions, dropdown, list) {
    this.renderSuggestions(suggestions, list);
    if (suggestions.length > 0) {
      this.hideSuggestions();
      dropdown.classList.remove('hidden');
    } else {
      dropdown.classList.add('hidden');
    }
  }

  renderSuggestions(suggestions, list) {
    list.innerHTML = '';

    suggestions.forEach((suggestion) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.dataset.value = suggestion;
      li.innerHTML = `
        <div class="suggestion-content">
          <svg class="suggestion-icon-external" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <div class="suggestion-text">
            <div class="suggestion-title">${escapeHTML(suggestion)}</div>
          </div>
        </div>
      `;
      list.appendChild(li);
    });
  }
}

function escapeHTML(str) {
  if (!str) {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SearchAutocomplete();
  });
} else {
  new SearchAutocomplete();
}
