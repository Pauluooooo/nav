/**
 * 搜索词联想功能 - 支持多个搜索框
 * 支持本地建议和外部搜索引擎 API 建议
 */

class SearchAutocomplete {
  constructor() {
    this.allBookmarks = [];
    this.suggestionCache = new Map();
    this.currentEngine = localStorage.getItem('search_engine') || 'local';

    // 防抖延迟（毫秒）
    this.DEBOUNCE_DELAY = 300;
    // 缓存时间（毫秒）
    this.CACHE_TTL = 5 * 60 * 1000;
    // 建议数量限制
    this.MAX_LOCAL_SUGGESTIONS = 8;
    this.MAX_EXTERNAL_SUGGESTIONS = 5;

    this.init();
  }

  /**
   * 初始化事件监听
   */
  init() {
    // 收集所有书签数据
    this.collectAllBookmarks();

    // 为每个搜索框初始化
    const searchWrappers = document.querySelectorAll('.search-input-target-wrapper');
    searchWrappers.forEach((wrapper, index) => {
      this.initializeWrapper(wrapper, index);
    });

    // 监听搜索引擎切换
    const engineOptions = document.querySelectorAll('.search-engine-option');
    engineOptions.forEach(option => {
      option.addEventListener('click', () => {
        this.currentEngine = option.dataset.engine;
        // 清除所有下拉列表
        document.querySelectorAll('.suggestion-dropdown').forEach(dropdown => {
          dropdown.classList.add('hidden');
        });
      });
    });

    // 点击页面其他区域关闭建议
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-input-target-wrapper')) {
        document.querySelectorAll('.suggestion-dropdown').forEach(dropdown => {
          dropdown.classList.add('hidden');
        });
      }
    });

    // 暴露到全局以便 main.js 访问
    window.searchAutocomplete = this;
  }

  /**
   * 初始化单个搜索框及其下拉列表
   */
  initializeWrapper(wrapper, index) {
    const input = wrapper.querySelector('.search-input-target');
    const dropdown = wrapper.querySelector('.suggestion-dropdown');
    const list = wrapper.querySelector('.suggestion-list');

    if (!input || !dropdown || !list) {
      console.warn(`[SearchAutocomplete] 搜索框${index}缺少必要元素`);
      return;
    }

    // 为每个输入框添加事件监听
    let debounceTimer = null;
    let selectedIndex = -1;
    let suggestions = [];

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const keyword = input.value.trim();

      if (!keyword) {
        dropdown.classList.add('hidden');
        return;
      }

      debounceTimer = setTimeout(async () => {
        await this.fetchAndRenderSuggestions(
          keyword,
          dropdown,
          list,
          index
        );
      }, this.DEBOUNCE_DELAY);
    });

    // 键盘导航
    input.addEventListener('keydown', e => {
      if (dropdown.classList.contains('hidden')) return;

      const items = list.querySelectorAll('.suggestion-item');
      if (items.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          selectedIndex = (selectedIndex + 1) % items.length;
          this.selectSuggestionItem(items, selectedIndex);
          break;

        case 'ArrowUp':
          e.preventDefault();
          selectedIndex = (selectedIndex - 1 + items.length) % items.length;
          this.selectSuggestionItem(items, selectedIndex);
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && items[selectedIndex]) {
            this.applySuggestionItem(items[selectedIndex], input, dropdown);
          }
          break;

        case 'Escape':
          e.preventDefault();
          dropdown.classList.add('hidden');
          break;
      }
    });

    // 失焦延迟关闭
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!wrapper.contains(document.activeElement)) {
          dropdown.classList.add('hidden');
        }
      }, 100);
    });

    // 处理建议项的点击和悬停
    list.addEventListener('mouseenter', e => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        const items = list.querySelectorAll('.suggestion-item');
        const index = Array.from(items).indexOf(item);
        this.selectSuggestionItem(items, index);
      }
    }, true);

    list.addEventListener('click', e => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        this.applySuggestionItem(item, input, dropdown);
      }
    });
  }

  /**
   * 从页面 DOM 中收集所有书签数据
   */
  collectAllBookmarks() {
    const cards = document.querySelectorAll('.site-card');
    this.allBookmarks = Array.from(cards).map(card => ({
      name: card.dataset.name || '',
      url: card.dataset.url || '',
      catalog: card.dataset.catalog || '',
      desc: card.dataset.desc || '',
      logo: card.querySelector('img')?.src || ''
    }));
  }

  /**
   * 获取并渲染建议
   */
  async fetchAndRenderSuggestions(keyword, dropdown, list, wrapperIndex) {
    const suggestions = [];

    // 1. 生成本地建议
    const localSuggestions = this.generateLocalSuggestions(keyword);
    suggestions.push(...localSuggestions);

    // 2. 获取外部建议（如果当前引擎不是本地）
    if (this.currentEngine !== 'local') {
      const externalSuggestions = await this.fetchExternalSuggestions(
        keyword,
        this.currentEngine
      );
      suggestions.push(...externalSuggestions);
    }

    // 3. 渲染建议
    if (suggestions.length > 0) {
      this.renderSuggestions(suggestions, list);
      dropdown.classList.remove('hidden');
    } else {
      dropdown.classList.add('hidden');
    }
  }

  /**
   * 生成本地建议（基于书签数据）
   */
  generateLocalSuggestions(keyword) {
    const suggestions = [];
    if (!keyword || keyword.length < 1) {
      return suggestions;
    }

    const lowerKeyword = keyword.toLowerCase();
    const scored = [];

    this.allBookmarks.forEach(site => {
      let score = 0;
      let matchSource = null;

      // 精确匹配
      if (site.name.toLowerCase() === lowerKeyword) {
        score = 100;
        matchSource = 'bookmark';
      }
      // 前缀匹配
      else if (site.name.toLowerCase().startsWith(lowerKeyword)) {
        score = 80;
        matchSource = 'bookmark';
      }
      // 包含匹配
      else if (site.name.toLowerCase().includes(lowerKeyword)) {
        score = 60;
        matchSource = 'bookmark';
      }
      // 分类匹配
      else if (site.catalog.toLowerCase().includes(lowerKeyword)) {
        score = 40;
        matchSource = 'category';
      }
      // 描述匹配
      else if (site.desc.toLowerCase().includes(lowerKeyword)) {
        score = 20;
        matchSource = 'desc';
      }
      // URL 匹配
      else if (site.url.toLowerCase().includes(lowerKeyword)) {
        score = 10;
        matchSource = 'url';
      }

      if (score > 0) {
        scored.push({
          ...site,
          score,
          matchSource
        });
      }
    });

    const seen = new Set();
    scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.name.length - b.name.length;
      })
      .slice(0, this.MAX_LOCAL_SUGGESTIONS)
      .forEach(item => {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          suggestions.push({
            type: 'local',
            text: item.name,
            category: item.catalog,
            icon: item.logo,
            url: item.url,
            source: item.matchSource
          });
        }
      });

    return suggestions;
  }

  /**
   * 获取外部搜索引擎建议
   */
  async fetchExternalSuggestions(keyword, engine) {
    const cacheKey = `${engine}:${keyword}`;

    // 检查缓存
    if (this.suggestionCache.has(cacheKey)) {
      const cached = this.suggestionCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.suggestions;
      } else {
        this.suggestionCache.delete(cacheKey);
      }
    }

    try {
      const response = await fetch(
        `/api/search/suggestions?q=${encodeURIComponent(keyword)}&engine=${engine}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const suggestions = (data.suggestions || [])
        .map(text => ({
          type: engine,
          text: text,
          icon: null,
          source: 'external'
        }))
        .slice(0, this.MAX_EXTERNAL_SUGGESTIONS);

      // 缓存结果
      this.suggestionCache.set(cacheKey, {
        suggestions,
        timestamp: Date.now()
      });

      return suggestions;
    } catch (error) {
      console.error('[External Suggestions] Error:', error);
      return [];
    }
  }

  /**
   * 渲染建议列表
   */
  renderSuggestions(suggestions, list) {
    list.innerHTML = '';

    suggestions.forEach((suggestion, index) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.dataset.index = index;

      if (suggestion.type === 'local') {
        li.innerHTML = `
          <div class="suggestion-content local-suggestion">
            <img src="${escapeHTML(suggestion.icon)}" alt="" class="suggestion-icon" onerror="this.style.display='none'">
            <div class="suggestion-text">
              <div class="suggestion-title">${escapeHTML(suggestion.text)}</div>
              <div class="suggestion-meta">
                <span class="suggestion-category">${escapeHTML(suggestion.category || '未分类')}</span>
                <span class="suggestion-source">${this.getSourceLabel(suggestion.source)}</span>
              </div>
            </div>
          </div>
        `;
      } else {
        li.innerHTML = `
          <div class="suggestion-content external-suggestion">
            <svg class="suggestion-icon-external" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <div class="suggestion-text">
              <div class="suggestion-title">${escapeHTML(suggestion.text)}</div>
              <div class="suggestion-engine">${this.getEngineName(suggestion.type)} 搜索</div>
            </div>
          </div>
        `;
      }

      list.appendChild(li);
    });
  }

  /**
   * 选择建议项
   */
  selectSuggestionItem(items, index) {
    const oldActive = document.querySelector('.suggestion-item.active');
    if (oldActive) oldActive.classList.remove('active');

    if (items[index]) {
      items[index].classList.add('active');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * 应用选中的建议
   */
  applySuggestionItem(item, input, dropdown) {
    const suggestion = {
      text: item.querySelector('.suggestion-title')?.textContent || '',
      type: item.querySelector('.suggestion-engine') ? 'external' : 'local'
    };

    if (!suggestion.text) return;

    input.value = suggestion.text;

    if (suggestion.type === 'local') {
      // 本地搜索
      if (typeof currentSearchEngine !== 'undefined') {
        currentSearchEngine = 'local';
      }
      if (typeof updateSearchEngineUI === 'function') {
        updateSearchEngineUI('local');
      }
      input.dispatchEvent(new Event('input'));
    } else {
      // 外部搜索
      const engineName = item.querySelector('.suggestion-engine')?.textContent?.split(' ')[0]?.toLowerCase() || 'baidu';
      if (typeof currentSearchEngine !== 'undefined') {
        currentSearchEngine = engineName;
      }
      localStorage.setItem('search_engine', engineName);
      if (typeof updateSearchEngineUI === 'function') {
        updateSearchEngineUI(engineName);
      }
    }

    dropdown.classList.add('hidden');
  }

  /**
   * 获取匹配来源标签
   */
  getSourceLabel(source) {
    const labels = {
      bookmark: '书签',
      category: '分类',
      desc: '描述',
      url: '链接'
    };
    return labels[source] || '其他';
  }

  /**
   * 获取搜索引擎名称
   */
  getEngineName(engine) {
    const names = {
      baidu: '百度',
      google: 'Google',
      bing: 'Bing'
    };
    return names[engine] || engine;
  }

  /**
   * 隐藏所有建议下拉列表
   */
  hideSuggestions() {
    document.querySelectorAll('.suggestion-dropdown').forEach(dropdown => {
      dropdown.classList.add('hidden');
    });
  }
}

/**
 * HTML 转义函数（防止 XSS）
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 初始化搜索词联想
 */
document.addEventListener('DOMContentLoaded', () => {
  new SearchAutocomplete();
});
