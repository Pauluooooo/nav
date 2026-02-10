/**
 * 搜索词联想功能
 * 支持本地建议和外部搜索引擎 API 建议
 */

class SearchAutocomplete {
  constructor() {
    this.searchInputs = document.querySelectorAll('.search-input-target');
    this.suggestionDropdown = document.getElementById('suggestionDropdown');
    this.suggestionList = document.getElementById('suggestionList');

    this.currentEngine = localStorage.getItem('search_engine') || 'local';
    this.debounceTimer = null;
    this.selectedIndex = -1;
    this.allBookmarks = [];
    this.suggestions = [];
    this.suggestionCache = new Map();

    // 防抖延迟（毫秒）
    this.DEBOUNCE_DELAY = 300;
    // 缓存时间（毫秒）
    this.CACHE_TTL = 5 * 60 * 1000;
    // 建议数量限制
    this.MAX_LOCAL_SUGGESTIONS = 8;
    this.MAX_EXTERNAL_SUGGESTIONS = 5;
    this.MAX_TOTAL_SUGGESTIONS = 12;

    this.init();
  }

  /**
   * 初始化事件监听
   */
  init() {
    // 收集所有书签数据
    this.collectAllBookmarks();

    // 监听搜索框输入
    this.searchInputs.forEach(input => {
      input.addEventListener('input', e => this.handleInput(e));
      input.addEventListener('keydown', e => this.handleKeydown(e));
      input.addEventListener('blur', () => this.handleBlur());
    });

    // 监听搜索引擎切换
    const engineOptions = document.querySelectorAll('.search-engine-option');
    engineOptions.forEach(option => {
      option.addEventListener('click', () => {
        this.currentEngine = option.dataset.engine;
        this.hideSuggestions();
      });
    });

    // 点击页面其他区域关闭建议
    document.addEventListener('click', e => {
      if (!e.target.closest('.search-input-target-wrapper')) {
        this.hideSuggestions();
      }
    });

    // 暴露到全局以便 main.js 访问
    window.searchAutocomplete = this;
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
   * 处理输入事件
   */
  handleInput(e) {
    const keyword = e.target.value.trim();

    // 清除之前的防抖
    clearTimeout(this.debounceTimer);

    // 如果为空，隐藏建议
    if (!keyword) {
      this.hideSuggestions();
      return;
    }

    // 防抖处理
    this.debounceTimer = setTimeout(() => {
      this.fetchSuggestions(keyword);
    }, this.DEBOUNCE_DELAY);
  }

  /**
   * 处理失焦事件（延迟关闭以允许点击建议）
   */
  handleBlur() {
    setTimeout(() => {
      if (
        !this.suggestionList.contains(document.activeElement) &&
        !this.searchInputs[0].contains(document.activeElement)
      ) {
        this.hideSuggestions();
      }
    }, 100);
  }

  /**
   * 获取建议（本地 + 外部）
   */
  async fetchSuggestions(keyword) {
    this.suggestions = [];
    this.selectedIndex = -1;

    try {
      // 1. 生成本地建议
      const localSuggestions = this.generateLocalSuggestions(keyword);
      this.suggestions.push(...localSuggestions);

      // 2. 获取外部建议（如果当前引擎不是本地）
      if (this.currentEngine !== 'local') {
        const externalSuggestions = await this.fetchExternalSuggestions(
          keyword,
          this.currentEngine
        );
        this.suggestions.push(...externalSuggestions);
      }

      // 显示建议
      if (this.suggestions.length > 0) {
        this.renderSuggestions();
        this.showSuggestions();
      } else {
        this.hideSuggestions();
      }
    } catch (error) {
      console.error('[Search Autocomplete] Error:', error);
      this.hideSuggestions();
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

    // 遍历所有书签，计算匹配分数
    this.allBookmarks.forEach(site => {
      let score = 0;
      let matchSource = null;

      // 精确匹配
      if (site.name.toLowerCase() === lowerKeyword) {
        score = 100;
        matchSource = 'bookmark';
      }
      // 前缀匹配书签名称
      else if (site.name.toLowerCase().startsWith(lowerKeyword)) {
        score = 80;
        matchSource = 'bookmark';
      }
      // 包含匹配书签名称
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

    // 排序、去重、限制数量
    const seen = new Set();
    scored
      .sort((a, b) => {
        // 按分数降序排列
        if (b.score !== a.score) return b.score - a.score;
        // 相同分数时按名称长度（越短越相关）
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
   * 渲染建议下拉列表
   */
  renderSuggestions() {
    this.suggestionList.innerHTML = '';

    this.suggestions.forEach((suggestion, index) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.dataset.index = index;

      if (suggestion.type === 'local') {
        // 本地建议
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
        // 外部建议
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

      // 鼠标悬停
      li.addEventListener('mouseenter', () => {
        this.selectSuggestion(index);
      });

      // 点击选择
      li.addEventListener('click', () => {
        this.selectSuggestion(index);
        this.applySuggestion(suggestion);
      });

      this.suggestionList.appendChild(li);
    });
  }

  /**
   * 显示建议下拉列表
   */
  showSuggestions() {
    this.suggestionDropdown.classList.remove('hidden');
  }

  /**
   * 隐藏建议下拉列表
   */
  hideSuggestions() {
    this.suggestionDropdown.classList.add('hidden');
    this.selectedIndex = -1;
  }

  /**
   * 选择建议项
   */
  selectSuggestion(index) {
    // 移除旧的活动状态
    const oldActive = this.suggestionList.querySelector('.suggestion-item.active');
    if (oldActive) oldActive.classList.remove('active');

    // 设置新的活动状态
    this.selectedIndex = index;
    const items = this.suggestionList.querySelectorAll('.suggestion-item');
    if (items[index]) {
      items[index].classList.add('active');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * 应用选中的建议
   */
  applySuggestion(suggestion) {
    // 更新搜索框
    const keyword = suggestion.text;
    this.searchInputs.forEach(input => {
      input.value = keyword;
    });

    if (suggestion.type === 'local') {
      // 本地搜索：直接过滤
      if (typeof currentSearchEngine !== 'undefined') {
        currentSearchEngine = 'local';
      }
      if (typeof updateSearchEngineUI === 'function') {
        updateSearchEngineUI('local');
      }
      this.searchInputs.forEach(input => {
        input.dispatchEvent(new Event('input'));
      });
    } else {
      // 外部搜索：切换到该引擎
      if (typeof currentSearchEngine !== 'undefined') {
        currentSearchEngine = suggestion.type;
      }
      localStorage.setItem('search_engine', suggestion.type);
      if (typeof updateSearchEngineUI === 'function') {
        updateSearchEngineUI(suggestion.type);
      }
    }

    this.hideSuggestions();
  }

  /**
   * 处理键盘事件
   */
  handleKeydown(e) {
    const itemCount = this.suggestions.length;

    // 如果没有建议或下拉列表隐藏，不处理
    if (
      itemCount === 0 ||
      this.suggestionDropdown.classList.contains('hidden')
    ) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % itemCount;
        this.selectSuggestion(this.selectedIndex);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + itemCount) % itemCount;
        this.selectSuggestion(this.selectedIndex);
        break;

      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && this.suggestions[this.selectedIndex]) {
          this.applySuggestion(this.suggestions[this.selectedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.hideSuggestions();
        break;
    }
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
