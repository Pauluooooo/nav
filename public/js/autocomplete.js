/**
 * 搜索词联想功能 - 使用 JSONP 绕过 CORS 限制
 * 支持百度、谷歌、必应等搜索引擎的联想词
 */

class SearchAutocomplete {
  constructor() {
    this.searchInputs = document.querySelectorAll('.search-input-target');
    this.allBookmarks = [];
    this.currentEngine = localStorage.getItem('search_engine') || 'local';
    this.debounceTimer = null;
    this.currentKeyword = '';

    // 防抖延迟（毫秒）
    this.DEBOUNCE_DELAY = 300;

    this.init();
  }

  /**
   * 初始化事件监听
   */
  init() {
    console.log('[SearchAutocomplete] 初始化开始');

    // 收集所有书签数据（本地搜索使用）
    this.collectAllBookmarks();
    console.log(`[SearchAutocomplete] 收集到 ${this.allBookmarks.length} 个书签`);

    // 为每个搜索框初始化
    const searchWrappers = document.querySelectorAll('.search-input-target-wrapper');
    console.log(`[SearchAutocomplete] 找到 ${searchWrappers.length} 个搜索框`);

    this.searchInputs.forEach((input, index) => {
      const wrapper = input.closest('.search-input-target-wrapper');
      if (!wrapper) return;

      const dropdown = wrapper.querySelector('.suggestion-dropdown');
      const list = wrapper.querySelector('.suggestion-list');

      if (!dropdown || !list) {
        console.error(`[SearchAutocomplete] 搜索框${index}缺少dropdown/list元素`);
        return;
      }

      // 监听输入事件
      input.addEventListener('input', () => {
        clearTimeout(this.debounceTimer);
        const keyword = input.value.trim();

        if (!keyword) {
          dropdown.classList.add('hidden');
          return;
        }

        this.currentKeyword = keyword;
        this.currentEngine = typeof currentSearchEngine !== 'undefined' ? currentSearchEngine : this.currentEngine;

        this.debounceTimer = setTimeout(() => {
          this.fetchSuggestions(keyword, dropdown, list, this.currentEngine);
        }, this.DEBOUNCE_DELAY);
      });

      // 键盘导航
      input.addEventListener('keydown', (e) => {
        if (dropdown.classList.contains('hidden')) return;

        const items = list.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;

        let currentActive = list.querySelector('.suggestion-item.active');
        let currentIndex = currentActive ? Array.from(items).indexOf(currentActive) : -1;

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            currentIndex = (currentIndex + 1) % items.length;
            this.selectItem(items, currentIndex);
            break;

          case 'ArrowUp':
            e.preventDefault();
            currentIndex = (currentIndex - 1 + items.length) % items.length;
            this.selectItem(items, currentIndex);
            break;

          case 'Enter':
            e.preventDefault();
            if (currentActive) {
              const text = currentActive.textContent.trim();
              input.value = text;
              dropdown.classList.add('hidden');
            }
            break;

          case 'Escape':
            e.preventDefault();
            dropdown.classList.add('hidden');
            break;
        }
      });

      // 失焦隐藏
      input.addEventListener('blur', () => {
        setTimeout(() => {
          dropdown.classList.add('hidden');
        }, 100);
      });

      // 列表项点击
      list.addEventListener('click', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (item) {
          input.value = item.textContent.trim();
          dropdown.classList.add('hidden');
        }
      });

      // 列表项悬停
      list.addEventListener('mouseenter', (e) => {
        const item = e.target.closest('.suggestion-item');
        if (item) {
          const items = list.querySelectorAll('.suggestion-item');
          const index = Array.from(items).indexOf(item);
          this.selectItem(items, index);
        }
      }, true);
    });

    // 监听搜索引擎切换
    const engineOptions = document.querySelectorAll('.search-engine-option');
    engineOptions.forEach(option => {
      option.addEventListener('click', () => {
        this.currentEngine = option.dataset.engine;
        // 隐藏所有下拉列表
        document.querySelectorAll('.suggestion-dropdown').forEach(d => {
          d.classList.add('hidden');
        });
      });
    });

    // 点击其他地方隐藏
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-input-target-wrapper')) {
        document.querySelectorAll('.suggestion-dropdown').forEach(d => {
          d.classList.add('hidden');
        });
      }
    });

    // 暴露到全局
    window.searchAutocomplete = this;
  }

  /**
   * 选中列表项
   */
  selectItem(items, index) {
    items.forEach(item => item.classList.remove('active'));
    if (items[index]) {
      items[index].classList.add('active');
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * 收集所有书签
   */
  collectAllBookmarks() {
    const cards = document.querySelectorAll('.site-card');
    this.allBookmarks = Array.from(cards).map(card => ({
      name: card.dataset.name || '',
      catalog: card.dataset.catalog || '',
      desc: card.dataset.desc || ''
    }));
  }

  /**
   * 生成本地建议 (基于书签)
   */
  generateLocalSuggestions(keyword) {
    if (!keyword) return [];

    const lowerKeyword = keyword.toLowerCase();
    const suggestions = [];
    const scored = [];

    // 评分算法
    this.allBookmarks.forEach(site => {
      let score = 0;

      if (site.name.toLowerCase() === lowerKeyword) {
        score = 100;
      } else if (site.name.toLowerCase().startsWith(lowerKeyword)) {
        score = 80;
      } else if (site.name.toLowerCase().includes(lowerKeyword)) {
        score = 60;
      } else if (site.catalog.toLowerCase().includes(lowerKeyword)) {
        score = 40;
      } else if (site.desc.toLowerCase().includes(lowerKeyword)) {
        score = 20;
      }

      if (score > 0) {
        scored.push({ ...site, score });
      }
    });

    // 排序去重
    const seen = new Set();
    scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .forEach(item => {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          suggestions.push(item.name);
        }
      });

    return suggestions;
  }

  /**
   * 获取外部建议 (使用 JSONP)
   */
  fetchSuggestions(keyword, dropdown, list, engine) {
    // 首先添加本地建议
    const localSuggestions = this.generateLocalSuggestions(keyword);

    // 然后获取外部建议
    if (engine === 'local') {
      // 只显示本地建议
      this.renderSuggestions(localSuggestions, list, 'local');
      if (localSuggestions.length > 0) {
        dropdown.classList.remove('hidden');
      } else {
        dropdown.classList.add('hidden');
      }
    } else if (engine === 'baidu') {
      // 使用 JSONP 获取百度建议
      this.fetchBaiduSuggestions(keyword, (suggestions) => {
        const all = [...localSuggestions, ...suggestions].slice(0, 10);
        this.renderSuggestions(all, list, 'mixed');
        if (all.length > 0) {
          dropdown.classList.remove('hidden');
        } else {
          dropdown.classList.add('hidden');
        }
      });
    } else if (engine === 'google') {
      // 使用 JSONP 获取谷歌建议 (通过 DuckDuckGo)
      this.fetchGoogleSuggestions(keyword, (suggestions) => {
        const all = [...localSuggestions, ...suggestions].slice(0, 10);
        this.renderSuggestions(all, list, 'mixed');
        if (all.length > 0) {
          dropdown.classList.remove('hidden');
        } else {
          dropdown.classList.add('hidden');
        }
      });
    } else if (engine === 'bing') {
      // Bing 搜索建议
      this.fetchBingSuggestions(keyword, (suggestions) => {
        const all = [...localSuggestions, ...suggestions].slice(0, 10);
        this.renderSuggestions(all, list, 'mixed');
        if (all.length > 0) {
          dropdown.classList.remove('hidden');
        } else {
          dropdown.classList.add('hidden');
        }
      });
    }
  }

  /**
   * 百度搜索建议 (JSONP)
   */
  fetchBaiduSuggestions(keyword, callback) {
    const callbackName = 'baidu_suggest_' + Date.now();

    window[callbackName] = (data) => {
      const suggestions = (data.s || []).slice(0, 5);
      callback(suggestions);
      // 清理
      delete window[callbackName];
      const script = document.getElementById('baidu-script');
      if (script) document.body.removeChild(script);
    };

    const script = document.createElement('script');
    script.id = 'baidu-script';
    script.src = `https://sp0.baidu.com/5a1Fazu8AA54nxGko9WTAnF6hhy/su?wd=${encodeURIComponent(keyword)}&cb=${callbackName}`;
    script.onerror = () => {
      callback([]);
      delete window[callbackName];
    };
    document.body.appendChild(script);
  }

  /**
   * 谷歌搜索建议 (通过 DuckDuckGo)
   */
  fetchGoogleSuggestions(keyword, callback) {
    const callbackName = 'google_suggest_' + Date.now();

    window[callbackName] = (data) => {
      const suggestions = (data || [])
        .filter(item => item && item.phrase)
        .map(item => item.phrase)
        .slice(0, 5);
      callback(suggestions);
      delete window[callbackName];
      const script = document.getElementById('google-script');
      if (script) document.body.removeChild(script);
    };

    // 使用 DuckDuckGo API
    const script = document.createElement('script');
    script.id = 'google-script';
    script.src = `https://ac.duckduckgo.com/ac/?q=${encodeURIComponent(keyword)}&type=list&format=json&callback=${callbackName}`;
    script.onerror = () => {
      callback([]);
      delete window[callbackName];
    };
    document.body.appendChild(script);
  }

  /**
   * 必应搜索建议 (JSONP)
   */
  fetchBingSuggestions(keyword, callback) {
    // Bing 一般不支持 JSONP，使用百度作为备选
    this.fetchBaiduSuggestions(keyword, callback);
  }

  /**
   * 渲染建议列表
   */
  renderSuggestions(suggestions, list, type) {
    list.innerHTML = '';

    suggestions.forEach((suggestion, index) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
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

/**
 * HTML 转义
 */
function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 初始化
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[SearchAutocomplete] DOM已加载，开始初始化');
    new SearchAutocomplete();
  });
} else {
  console.log('[SearchAutocomplete] 页面已加载，立即初始化');
  new SearchAutocomplete();
}
