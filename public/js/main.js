document.addEventListener('DOMContentLoaded', function() {
  // 绂佺敤娴忚鍣ㄨ嚜鍔ㄦ粴鍔ㄦ仮澶嶏紝纭繚鍒锋柊鍚庡缁堜粠椤堕儴寮€濮?
  if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
  }

  // ========== 渚ц竟鏍忔帶鍒?==========
  const appScroll = document.getElementById('app-scroll');
  const scrollContainer = appScroll || window;

  function getCurrentScrollTop() {
    const appScrollTop = appScroll ? (appScroll.scrollTop || 0) : 0;
    const windowScrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    return Math.max(appScrollTop, windowScrollTop);
  }

  function getMaxScrollTop() {
    if (appScroll) {
      const scrollHeight = Number(appScroll.scrollHeight || 0);
      const clientHeight = Number(appScroll.clientHeight || 0);
      return Math.max(0, scrollHeight - clientHeight);
    }

    const doc = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(
      Number(doc?.scrollHeight || 0),
      Number(body?.scrollHeight || 0)
    );
    const clientHeight = Math.max(
      Number(doc?.clientHeight || 0),
      Number(window.innerHeight || 0)
    );
    return Math.max(0, scrollHeight - clientHeight);
  }

  function forceScrollTopNow() {
    if (appScroll) appScroll.scrollTop = 0;
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function resetScrollToTop() {
    forceScrollTopNow();
    // Run extra passes to override late scroll restoration on mobile browsers.
    requestAnimationFrame(forceScrollTopNow);
    setTimeout(forceScrollTopNow, 120);
  }

  function smoothScrollTo(top) {
    const targetTop = Math.max(0, Number(top) || 0);
    if (appScroll) {
      appScroll.scrollTo({ top: targetTop, behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: targetTop, behavior: 'smooth' });
  }

  function getElementScrollTop(element) {
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    if (appScroll) {
      const containerRect = appScroll.getBoundingClientRect();
      return rect.top - containerRect.top + appScroll.scrollTop;
    }
    return rect.top + window.scrollY;
  }

  function runWhenIdle(task, timeout = 300) {
    if (typeof task !== 'function') return;
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => task(), { timeout });
      return;
    }
    setTimeout(task, 0);
  }

  function waitForIdle(timeout = 300) {
    return new Promise((resolve) => runWhenIdle(resolve, timeout));
  }

  function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  }

  function setupViewportStability() {
    const bgContainer = document.getElementById('fixed-background');
    if (!bgContainer) return;

    const root = document.documentElement;
    let stableHeight = Math.max(window.innerHeight || 0, window.visualViewport?.height || 0);

    const applyStableHeight = (height) => {
      const nextHeight = Math.max(320, Math.round(height || window.innerHeight || 0));
      stableHeight = nextHeight;
      root.style.setProperty('--iori-stable-vh', `${nextHeight}px`);
    };

    const isKeyboardLikelyOpen = () => {
      const active = document.activeElement;
      if (!isEditableTarget(active)) return false;
      const vvHeight = window.visualViewport?.height;
      if (!vvHeight) return true;
      return stableHeight - vvHeight > 120;
    };

    const syncStableHeight = () => {
      const keyboardOpen = isKeyboardLikelyOpen();
      document.body.classList.toggle('keyboard-open', keyboardOpen);
      if (keyboardOpen) return;
      const vvHeight = window.visualViewport?.height;
      const currentHeight = Math.max(window.innerHeight || 0, vvHeight || 0);
      if (!currentHeight || Math.abs(currentHeight - stableHeight) < 8) return;
      applyStableHeight(currentHeight);
    };

    const updateKeyboardState = () => {
      const keyboardOpen = isKeyboardLikelyOpen();
      document.body.classList.toggle('keyboard-open', keyboardOpen);
      if (!keyboardOpen) {
        setTimeout(syncStableHeight, 160);
      }
    };

    applyStableHeight(stableHeight);
    window.addEventListener('resize', syncStableHeight, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(syncStableHeight, 200), { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncStableHeight, { passive: true });
    }
    document.addEventListener('focusin', updateKeyboardState, true);
    document.addEventListener('focusout', () => setTimeout(updateKeyboardState, 0), true);
  }

  setupViewportStability();
  
  function closeSidebarMenu() {
    // Unified layout no longer uses mobile sidebar navigation.
  }
  
  // Clean up initial server-side rendered cards animation
  const initialCards = document.querySelectorAll('.site-card.card-anim-enter');
  initialCards.forEach(card => {
      card.addEventListener('animationend', () => {
          card.classList.remove('card-anim-enter');
          // Clean up inline animation-delay style if present
          if (card.style.animationDelay) {
              card.style.removeProperty('animation-delay');
          }
      }, { once: true });
  });
  
  // ========== 澶嶅埗閾炬帴鍔熻兘 ==========
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const url = this.getAttribute('data-url');
      if (!url) return;
      
      navigator.clipboard.writeText(url).then(() => {
        showCopySuccess(this);
      }).catch(() => {
        // 澶囩敤鏂规硶
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          showCopySuccess(this);
        } catch (e) {
          alert('Copy failed. Please copy manually.');
        }
        document.body.removeChild(textarea);
      });
    });
  });
  
  function showCopySuccess(btn) {
    const successMsg = btn.querySelector('.copy-success');
    successMsg.classList.remove('hidden');
    successMsg.classList.add('copy-success-animation');
    setTimeout(() => {
      successMsg.classList.add('hidden');
      successMsg.classList.remove('copy-success-animation');
    }, 2000);
  }
  
  // ========== 杩斿洖椤堕儴 ==========
  const backToTop = document.getElementById('backToTop');

  function setBackToTopVisibility(visible) {
      if (!backToTop) return;
      backToTop.classList.toggle('back-to-top-visible', !!visible);
  }

  function setupBackToTopController() {
      if (!backToTop) return;
      backToTop.classList.remove('opacity-0', 'opacity-100', 'invisible', 'visible');

      const SHOW_AFTER_PX = 16;
      const TOP_EPSILON_PX = 2;
      const SHORT_PAGE_RATIO = 0.5;
      let rafId = 0;

      const resolveThreshold = () => {
          const maxScroll = getMaxScrollTop();
          if (maxScroll <= 0) return Number.POSITIVE_INFINITY;
          return Math.max(1, Math.min(SHOW_AFTER_PX, Math.floor(maxScroll * SHORT_PAGE_RATIO)));
      };

      const syncVisibility = () => {
          rafId = 0;
          const currentTop = getCurrentScrollTop();
          if (currentTop <= TOP_EPSILON_PX) {
              setBackToTopVisibility(false);
              return;
          }
          const threshold = resolveThreshold();
          setBackToTopVisibility(currentTop >= threshold);
      };

      const requestSync = () => {
          if (rafId) return;
          rafId = requestAnimationFrame(syncVisibility);
      };

      const showOnDownwardIntent = () => {
          if (getCurrentScrollTop() > TOP_EPSILON_PX) {
              setBackToTopVisibility(true);
              return;
          }
          requestSync();
      };

      scrollContainer.addEventListener('scroll', requestSync, { passive: true });
      if (appScroll) {
          window.addEventListener('scroll', requestSync, { passive: true });
      }
      window.addEventListener('wheel', (event) => {
          if (event.deltaY > 0) showOnDownwardIntent();
      }, { passive: true });
      window.addEventListener('touchmove', showOnDownwardIntent, { passive: true });
      window.addEventListener('keydown', (event) => {
          if (['PageDown', 'ArrowDown', ' '].includes(event.key)) showOnDownwardIntent();
      }, { passive: true });
      window.addEventListener('resize', requestSync, { passive: true });

      backToTop.addEventListener('click', (event) => {
          event.preventDefault();
          smoothScrollTo(0);
      });

      requestSync();
  }

  setupBackToTopController();
  
  // ========== 妯℃€佹鎺у埗 ==========
  const addSiteModal = document.getElementById('addSiteModal');
  const addSiteBtnSidebar = document.getElementById('addSiteBtnSidebar');
  const closeModalBtn = document.getElementById('closeModal');
  const cancelAddSite = document.getElementById('cancelAddSite');
  const addSiteForm = document.getElementById('addSiteForm');
  
  function openModal() {
    addSiteModal?.classList.remove('opacity-0', 'invisible');
    addSiteModal?.querySelector('.max-w-md')?.classList.remove('translate-y-8');
    document.body.style.overflow = 'hidden';
  }
  
  function closeModal() {
    addSiteModal?.classList.add('opacity-0', 'invisible');
    addSiteModal?.querySelector('.max-w-md')?.classList.add('translate-y-8');
    document.body.style.overflow = '';
  }
  
  async function fetchCategoriesForSelect() {
    const selectElement = document.getElementById('addSiteCatelog');
    if (!selectElement) return;

    try {
      const response = await fetch('/api/categories?pageSize=999');
      const data = await response.json();
      if (data.code === 200 && data.data) {
        selectElement.innerHTML = '<option value="" disabled selected>请选择一个分类</option>';
        data.data.forEach(category => {
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = category.catelog;
          selectElement.appendChild(option);
        });
      } else {
        selectElement.innerHTML = '<option value="" disabled>无法加载分类</option>';
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      selectElement.innerHTML = '<option value="" disabled>加载分类失败</option>';
    }
  }

  addSiteBtnSidebar?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
    fetchCategoriesForSelect();
  });
  
  closeModalBtn?.addEventListener('click', closeModal);
  cancelAddSite?.addEventListener('click', closeModal);
  addSiteModal?.addEventListener('click', (e) => {
    if (e.target === addSiteModal) closeModal();
  });
  
  // ========== 琛ㄥ崟鎻愪氦 ==========
  addSiteForm?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const data = {
      name: document.getElementById('addSiteName').value,
      url: document.getElementById('addSiteUrl').value,
      logo: document.getElementById('addSiteLogo').value,
      desc: document.getElementById('addSiteDesc').value,
      catelog_id: document.getElementById('addSiteCatelog').value
    };
    
    fetch('/api/config/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    .then(res => res.json())
    .then(data => {
      if (data.code === 201) {
        showToast('Submitted successfully. Pending admin review.');
        closeModal();
        addSiteForm.reset();
      } else {
        alert(data.message || '提交失败');
      }
    })
    .catch(err => {
      console.error('网络错误:', err);
      alert('Network error. Please try again later.');
    });
  });
  
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-accent-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
  
  // ========== 鎼滅储鍔熻兘 ==========
  const searchInputs = document.querySelectorAll('.search-input-target');
  const sitesGrid = document.getElementById('sitesGrid');
  
  const allowedSearchEngines = new Set(['local', 'google', 'baidu', 'bing']);
  const configuredSearchEngine = String(window.IORI_LAYOUT_CONFIG?.searchEngine || 'local').toLowerCase();
  const currentSearchEngine = allowedSearchEngines.has(configuredSearchEngine) ? configuredSearchEngine : 'local';
  window.currentSearchEngine = currentSearchEngine;

  const searchPlaceholderMap = {
      local: '搜索书签...',
      google: 'Google 搜索...',
      baidu: '百度搜索...',
      bing: 'Bing 搜索...'
  };
  let currentSearchKeyword = '';
  const searchPlaceholder = searchPlaceholderMap[currentSearchEngine] || searchPlaceholderMap.local;
  searchInputs.forEach((input) => {
      input.placeholder = searchPlaceholder;
  });

  function clearSearchInputsAfterSubmit() {
    currentSearchKeyword = '';
    searchInputs.forEach((input) => {
      input.value = '';
    });
    const visibleCount = filterVisibleCards('');
    updateHeading('', undefined, visibleCount);
    if (window.searchAutocomplete && typeof window.searchAutocomplete.hideSuggestions === 'function') {
      window.searchAutocomplete.hideSuggestions();
    }
  }
  window.clearSearchInputsAfterSubmit = clearSearchInputsAfterSubmit;
  
  searchInputs.forEach(input => {
    // Search Input Handler (always filters local cards)
    input.addEventListener('input', function() {
        currentSearchKeyword = this.value.trim();
        // Sync other inputs
        searchInputs.forEach(otherInput => {
            if (otherInput !== this) {
                otherInput.value = this.value;
            }
        });

        const visibleCount = filterVisibleCards(currentSearchKeyword);
        updateHeading(currentSearchKeyword, undefined, visibleCount);
    });

    // External Search Enter Handler
    input.addEventListener('keydown', function(e) {
        if (e.defaultPrevented) return;
        if (e.key === 'Enter' && currentSearchEngine !== 'local') {
            e.preventDefault();
            const query = this.value.trim();
            if (query) {
                let url = '';
                switch (currentSearchEngine) {
                    case 'google': url = `https://www.google.com/search?q=${encodeURIComponent(query)}`; break;
                    case 'baidu': url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`; break;
                    case 'bing': url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`; break;
                }
                if (url) {
                    window.open(url, '_blank');
                    clearSearchInputsAfterSubmit();
                }
            }
        }
    });
  });
  
  function updateGroupVisibility() {
    const groups = sitesGrid?.querySelectorAll('.bookmark-group');
    groups?.forEach(group => {
      const visibleCards = group.querySelectorAll('.site-card:not(.hidden)').length;
      group.classList.toggle('hidden', visibleCards === 0);
    });
  }

  function filterVisibleCards(keyword) {
    const normalized = String(keyword || '').toLowerCase().trim();
    const cards = sitesGrid?.querySelectorAll('.site-card');

    cards?.forEach(card => {
      const name = (card.dataset.name || '').toLowerCase();
      const url = (card.dataset.url || '').toLowerCase();
      const catalog = (card.dataset.catalog || '').toLowerCase();
      const desc = (card.dataset.desc || '').toLowerCase();
      const matched = !normalized || name.includes(normalized) || url.includes(normalized) || catalog.includes(normalized) || desc.includes(normalized);
      card.classList.toggle('hidden', !matched);
    });

    updateGroupVisibility();
    return sitesGrid?.querySelectorAll('.site-card:not(.hidden)').length || 0;
  }

  function updateHeading(keyword, activeCatalog, count) {
    const heading = document.querySelector('[data-role="list-heading"]');
    if (!heading) return;
    
    const visibleCount = (count !== undefined) ? count : (sitesGrid?.querySelectorAll('.site-card:not(.hidden)').length || 0);
    const isMobile = window.innerWidth < 440;
    
    // Explicitly handle navigation state
    if (activeCatalog !== undefined) {
        if (activeCatalog) {
            heading.dataset.active = activeCatalog;
        } else {
            // Null or empty string means "All Categories"
            delete heading.dataset.active;
        }
    }
    
    if (keyword) {
      heading.textContent = isMobile
        ? `${visibleCount} results`
        : `Search results · ${visibleCount} bookmarks`;
    } else {
      const currentActive = heading.dataset.active;
      if (isMobile) {
        heading.textContent = `${visibleCount} bookmarks`;
      } else if (currentActive) {
        heading.textContent = `${currentActive} · ${visibleCount} bookmarks`;
      } else {
        heading.textContent = `All bookmarks · ${visibleCount} bookmarks`;
      }
    }
  }

  // 鍒濇鍔犺浇鏃舵牴鎹睆骞曞搴︿慨姝ｆ爣棰樻樉绀?
  updateHeading();
  groupRenderedCards();

  // ========== 涓€瑷€ API ==========
  const hitokotoContainer = document.querySelector('#hitokoto')?.parentElement;
  // 妫€鏌ュ鍣ㄦ槸鍚﹁闅愯棌锛屽鏋滈殣钘忓垯涓嶅彂璧疯姹?
  if (hitokotoContainer && !hitokotoContainer.classList.contains('hidden')) {
    console.log('[Debug] Fetching hitokoto...');
    fetch('https://v1.hitokoto.cn')
      .then(res => res.json())
      .then(data => {
        const hitokoto = document.getElementById('hitokoto_text');
        if (hitokoto) {
          hitokoto.href = `https://hitokoto.cn/?uuid=${data.uuid}`;
          hitokoto.innerText = data.hitokoto;
        }
      })
      .catch(console.error);
  }

  // 宸茬鐢ㄩ〉闈㈠垵娆℃牴鎹?URL 瀹氫綅鍒嗙被鐨勮嚜鍔ㄨ烦杞紝浠ョ‘淇濇瘡娆″埛鏂伴兘鏄剧ず鍏ㄩ儴鍒嗙被
  (function initialCatalogScroll() {
      // Intentionally left blank.
  })();

  function findCategoryGroupSection(catalogId, catalogName = '') {
      if (!sitesGrid) return null;
      if (catalogId) {
          const escapedId = (window.CSS && typeof window.CSS.escape === 'function')
              ? window.CSS.escape(String(catalogId))
              : String(catalogId).replace(/"/g, '\\"');
          const byId = sitesGrid.querySelector(`.bookmark-group[data-catalog-id="${escapedId}"]`);
          if (byId) return byId;
      }

      const normalizedName = String(catalogName || '').trim();
      if (normalizedName) {
          const groups = sitesGrid.querySelectorAll('.bookmark-group[data-catalog-name]');
          for (const group of groups) {
              if (String(group.dataset.catalogName || '').trim() === normalizedName) {
                  return group;
              }
          }
      }
      return null;
  }

  function locateCategoryGroup(catalogId, catalogName = '') {
      const targetSection = findCategoryGroupSection(catalogId, catalogName);
      if (!targetSection) return null;

      const header = document.querySelector('header');
      const offset = (header ? header.getBoundingClientRect().height : 80) + 16;
      const targetTop = getElementScrollTop(targetSection) - offset;
      smoothScrollTo(targetTop);

      document.querySelectorAll('.bookmark-group.group-locate-active').forEach(group => {
          group.classList.remove('group-locate-active');
      });
      targetSection.classList.add('group-locate-active');
      if (targetSection.__locateTimer) {
          clearTimeout(targetSection.__locateTimer);
      }
      targetSection.__locateTimer = setTimeout(() => {
          targetSection.classList.remove('group-locate-active');
      }, 1400);

      return targetSection;
  }

  function ensureAllSitesRenderedForGroupedView() {
      if (!Array.isArray(window.IORI_SITES)) return 0;
      const allSites = window.IORI_SITES;
      const renderedCount = sitesGrid?.querySelectorAll('.site-card').length || 0;
      const isGrouped = sitesGrid?.classList.contains('sites-grid-grouped');
      if (!isGrouped || renderedCount !== allSites.length) {
          renderSites(allSites);
      }
      return sitesGrid?.querySelectorAll('.site-card:not(.hidden)').length || 0;
  }

  // ========== AJAX Navigation ==========
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    let parsedHref;
    try {
        parsedHref = new URL(link.getAttribute('href'), window.location.href);
    } catch (_error) {
        return;
    }
    if (parsedHref.origin !== window.location.origin || parsedHref.pathname !== window.location.pathname) {
        return;
    }
    const catalogParam = parsedHref.searchParams.get('catalog');
    if (catalogParam === null) return;
    
    // Allow new tab clicks
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    const href = parsedHref.pathname + parsedHref.search + parsedHref.hash;
    const catalogId = String(link.getAttribute('data-id') || '').trim();
    const catalogName = String(catalogParam || '').trim() || link.textContent.trim();
    
    if (typeof closeSidebarMenu === 'function') {
        closeSidebarMenu();
    }

    if (!sitesGrid || !Array.isArray(window.IORI_SITES)) {
        window.location.href = href;
        return;
    }

    const visibleCount = ensureAllSitesRenderedForGroupedView();

    if (!catalogId) {
        updateNavigationState(null);
        updateHeading(currentSearchKeyword, null, visibleCount);
        smoothScrollTo(0);
        history.replaceState(null, '', window.location.pathname);
    } else {
        updateNavigationState(catalogId);
        const targetSection = locateCategoryGroup(catalogId, catalogName);
        const groupVisibleCount = targetSection
            ? targetSection.querySelectorAll('.site-card:not(.hidden)').length
            : visibleCount;
        updateHeading(currentSearchKeyword, catalogName || null, groupVisibleCount);
        history.replaceState(null, '', window.location.pathname);
    }
  });

  function setCookie(name, value, days) {
      let expires = "";
      if (days) {
          const date = new Date();
          date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
          expires = "; expires=" + date.toUTCString();
      }
      document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax";
  }

  function getCategoryOrderMap() {
      const orderMap = new Map();
      let order = 0;
      document.querySelectorAll('#horizontalCategoryNav a[data-id]').forEach(link => {
          const id = String(link.getAttribute('data-id') || '').trim();
          if (!id || orderMap.has(id)) return;
          orderMap.set(id, order++);
      });
      return orderMap;
  }

  function findCatalogIdByName(name) {
      const normalizedName = String(name || '').trim();
      if (!normalizedName) return '';
      const links = document.querySelectorAll('#horizontalCategoryNav a[data-id]');
      for (const link of links) {
          const titleName = String(link.getAttribute('title') || '').trim();
          const text = String(link.textContent || '').replace(/\s+/g, ' ').trim();
          const plainText = text.replace(/^[·\s]+/, '').trim();
          if (titleName === normalizedName || text === normalizedName || plainText === normalizedName) {
              return String(link.getAttribute('data-id') || '');
          }
      }
      return '';
  }

  function getGroupStorageKey(groupName, catalogId = '') {
      const normalizedCatalogId = String(catalogId || '').trim();
      const resolvedCatalogId = normalizedCatalogId || findCatalogIdByName(groupName);
      const key = resolvedCatalogId || String(groupName || '').toLowerCase();
      return `iori_group_sort_${encodeURIComponent(key)}`;
  }

  function loadGroupSortOrder(groupName, catalogId = '') {
      const raw = localStorage.getItem(getGroupStorageKey(groupName, catalogId));
      if (!raw) return [];
      try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.map(id => String(id)) : [];
      } catch (_error) {
          return [];
      }
  }

  function applyGroupSortOrder(groupName, cards, catalogId = '') {
      const orderList = loadGroupSortOrder(groupName, catalogId);
      if (!orderList.length) return cards;
      const orderIndex = new Map(orderList.map((id, index) => [String(id), index]));
      return [...cards].sort((a, b) => {
          const aId = String(a.getAttribute('data-id') || '');
          const bId = String(b.getAttribute('data-id') || '');
          const aRank = orderIndex.has(aId) ? orderIndex.get(aId) : Number.MAX_SAFE_INTEGER;
          const bRank = orderIndex.has(bId) ? orderIndex.get(bId) : Number.MAX_SAFE_INTEGER;
          if (aRank !== bRank) return aRank - bRank;
          return 0;
      });
  }

  function saveGroupSortOrder(groupName, groupGrid, catalogId = '') {
      if (!groupGrid) return;
      const ids = Array.from(groupGrid.querySelectorAll('.site-card'))
          .map(card => card.getAttribute('data-id'))
          .filter(Boolean);
      localStorage.setItem(getGroupStorageKey(groupName, catalogId), JSON.stringify(ids));
  }

  function getGroupGridClass(gridCols) {
      const value = String(gridCols || '4');
      if (value === '5') return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-6 justify-items-center';
      if (value === '6') return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 min-[1200px]:grid-cols-6 gap-3 sm:gap-6 justify-items-center';
      if (value === '7') return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 sm:gap-6 justify-items-center';
      return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 justify-items-center';
  }

  function setupGroupSorting(groupGrid, groupName, catalogId = '') {
      let draggedItem = null;

      groupGrid.addEventListener('dragstart', (event) => {
          const card = event.target.closest('.site-card');
          if (!card || card.parentElement !== groupGrid) return;
          draggedItem = card;
          draggedItem.classList.add('dragging');
          document.body.classList.add('drag-sorting');
          if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', draggedItem.getAttribute('data-id') || '');
          }
      });

      groupGrid.addEventListener('dragover', (event) => {
          if (!draggedItem) return;
          event.preventDefault();
          const target = event.target.closest('.site-card');
          if (!target || target === draggedItem || target.parentElement !== groupGrid) return;
          const rect = target.getBoundingClientRect();
          const placeAfter = event.clientY > rect.top + rect.height / 2;
          if (placeAfter) target.after(draggedItem);
          else target.before(draggedItem);
      });

      groupGrid.addEventListener('dragend', () => {
          if (!draggedItem) return;
          draggedItem.classList.remove('dragging');
          draggedItem = null;
          document.body.classList.remove('drag-sorting');
          saveGroupSortOrder(groupName, groupGrid, catalogId);
      });

      // Touch sorting (mobile)
      const HOLD_DELAY = 220;
      const CANCEL_DISTANCE = 10;
      let holdTimer = null;
      let dragCard = null;
      let dragGhost = null;
      let startX = 0;
      let startY = 0;
      let offsetX = 0;
      let offsetY = 0;
      let suppressClick = false;

      const clearHoldTimer = () => {
          if (!holdTimer) return;
          clearTimeout(holdTimer);
          holdTimer = null;
      };

      const moveGhost = (x, y) => {
          if (!dragGhost) return;
          dragGhost.style.left = `${x - offsetX}px`;
          dragGhost.style.top = `${y - offsetY}px`;
      };

      const finishTouchDrag = () => {
          if (!dragCard) return;
          dragCard.style.visibility = '';
          dragCard.classList.remove('touch-sort-origin');
          dragCard = null;
          if (dragGhost) {
              dragGhost.remove();
              dragGhost = null;
          }
          document.body.classList.remove('drag-sorting');
          saveGroupSortOrder(groupName, groupGrid, catalogId);
      };

      groupGrid.addEventListener('touchstart', (event) => {
          if (event.touches.length !== 1) return;
          const card = event.target.closest('.site-card');
          if (!card || card.parentElement !== groupGrid) return;
          const touch = event.touches[0];
          startX = touch.clientX;
          startY = touch.clientY;
          clearHoldTimer();
          holdTimer = setTimeout(() => {
              dragCard = card;
              suppressClick = true;
              const rect = card.getBoundingClientRect();
              offsetX = touch.clientX - rect.left;
              offsetY = touch.clientY - rect.top;
              dragGhost = card.cloneNode(true);
              dragGhost.classList.add('touch-drag-ghost');
              dragGhost.style.width = `${rect.width}px`;
              dragGhost.style.height = `${rect.height}px`;
              moveGhost(touch.clientX, touch.clientY);
              document.body.appendChild(dragGhost);
              card.style.visibility = 'hidden';
              card.classList.add('touch-sort-origin');
              document.body.classList.add('drag-sorting');
          }, HOLD_DELAY);
      }, { passive: true });

      groupGrid.addEventListener('touchmove', (event) => {
          const touch = event.touches[0];
          if (!touch) return;

          if (!dragCard) {
              if (holdTimer) {
                  const movedX = Math.abs(touch.clientX - startX);
                  const movedY = Math.abs(touch.clientY - startY);
                  if (movedX > CANCEL_DISTANCE || movedY > CANCEL_DISTANCE) clearHoldTimer();
              }
              return;
          }

          event.preventDefault();
          moveGhost(touch.clientX, touch.clientY);
          const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.site-card');
          if (!target || target === dragCard || target.parentElement !== groupGrid) return;
          const rect = target.getBoundingClientRect();
          const placeAfter = touch.clientY > rect.top + rect.height / 2;
          if (placeAfter) target.after(dragCard);
          else target.before(dragCard);
      }, { passive: false });

      groupGrid.addEventListener('touchend', () => {
          clearHoldTimer();
          finishTouchDrag();
      }, { passive: true });

      groupGrid.addEventListener('touchcancel', () => {
          clearHoldTimer();
          finishTouchDrag();
      }, { passive: true });

      groupGrid.addEventListener('click', (event) => {
          if (!suppressClick) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClick = false;
      }, true);
  }

  function groupRenderedCards() {
      if (!sitesGrid) return;
      const cards = Array.from(sitesGrid.querySelectorAll(':scope > .site-card'));
      if (!cards.length) {
          updateGroupVisibility();
          return;
      }
      const config = window.IORI_LAYOUT_CONFIG || {};
      const groupedGridClass = getGroupGridClass(config.gridCols);
      const removableGridTokens = [
          'grid',
          'grid-cols-1',
          'grid-cols-2',
          'sm:grid-cols-2',
          'md:grid-cols-3',
          'lg:grid-cols-3',
          'lg:grid-cols-4',
          'lg:grid-cols-5',
          'xl:grid-cols-4',
          'xl:grid-cols-7',
          'min-[1200px]:grid-cols-6',
          'gap-3',
          'gap-4',
          'sm:gap-6',
          'justify-items-center',
          'sites-grid-grouped'
      ];

      const fallbackFlatLayout = () => {
          sitesGrid.classList.remove(...removableGridTokens);
          groupedGridClass.split(' ').filter(Boolean).forEach(token => sitesGrid.classList.add(token));
          sitesGrid.innerHTML = '';
          cards.forEach(card => {
              card.classList.remove('hidden', 'dragging', 'touch-sort-origin');
              card.draggable = false;
              sitesGrid.appendChild(card);
          });
      };

      try {

      sitesGrid.classList.remove(...removableGridTokens);
      sitesGrid.classList.add('sites-grid-grouped');
      sitesGrid.innerHTML = '';

      const grouped = new Map();
      cards.forEach(card => {
          const groupName = String(card.dataset.catalog || '').trim() || 'Uncategorized';
          if (!grouped.has(groupName)) grouped.set(groupName, []);
          grouped.get(groupName).push(card);
      });

      const categoryOrderMap = getCategoryOrderMap();
      const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
          const aId = findCatalogIdByName(a[0]);
          const bId = findCatalogIdByName(b[0]);
          const aOrder = aId && categoryOrderMap.has(aId) ? categoryOrderMap.get(aId) : Number.MAX_SAFE_INTEGER;
          const bOrder = bId && categoryOrderMap.has(bId) ? categoryOrderMap.get(bId) : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return String(a[0]).localeCompare(String(b[0]), 'zh-Hans-CN');
      });

      sortedGroups.forEach(([groupName, groupCards]) => {
          const catalogId = findCatalogIdByName(groupName);
          const orderedCards = applyGroupSortOrder(groupName, groupCards, catalogId);
          const section = document.createElement('section');
          section.className = 'bookmark-group';
          if (catalogId) {
              section.dataset.catalogId = String(catalogId);
          }
          section.dataset.catalogName = String(groupName || '');

          section.innerHTML = `
            <div class="bookmark-group-header">
              <div class="bookmark-group-title">
                <svg xmlns="http://www.w3.org/2000/svg" class="bookmark-group-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v1H3V7zM3 10h18v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z" />
                </svg>
                <span class="bookmark-group-name">${escapeHTML(groupName)}</span>
                <span class="bookmark-group-count">${orderedCards.length}</span>
              </div>
              <span class="bookmark-group-sort-hint">拖动排序</span>
            </div>
          `;

          const groupGrid = document.createElement('div');
          groupGrid.className = `${groupedGridClass} group-sites-grid`;

          orderedCards.forEach(card => {
              card.classList.remove('hidden');
              card.draggable = true;
              groupGrid.appendChild(card);
          });

          section.appendChild(groupGrid);
          sitesGrid.appendChild(section);
          setupGroupSorting(groupGrid, groupName, catalogId);
      });
      } catch (error) {
          console.error('[groupRenderedCards] fallback to flat layout:', error);
          fallbackFlatLayout();
      }
  }

  function renderSites(sites) {
      const sitesGrid = document.getElementById('sitesGrid');
      if (!sitesGrid) return;
      
      // 浣跨敤鍏ㄥ眬閰嶇疆鑾峰彇甯冨眬璁剧疆锛岄伩鍏嶄緷璧?DOM 鎺ㄦ柇
      const config = window.IORI_LAYOUT_CONFIG || {};
      const cardStyle = config.cardStyle || 'style1';
      const useCompactCard = true;
      
      // 浼樺厛浠庨厤缃幏鍙栨瘺鐜荤拑寮€鍏崇姸鎬侊紝CSS 鍙橀噺浣滀负鍥為€€
      const computedStyle = getComputedStyle(document.documentElement);
      const frostedBlurVal = computedStyle.getPropertyValue('--frosted-glass-blur').trim();
      const isFrostedEnabled = config.enableFrostedGlass !== undefined 
          ? config.enableFrostedGlass 
          : (frostedBlurVal !== '');
      
      sitesGrid.innerHTML = '';
      
      if (sites.length === 0) {
          sitesGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">当前分类下暂无书签</div>';
          return;
      }

      sites.forEach((site, index) => {
        const rawName = String(site.name || 'Unnamed');
        const safeName = escapeHTML(rawName);
        const safeUrl = normalizeUrl(site.url);
        const safeDesc = escapeHTML(site.desc || 'No description');
        const safeCatalog = escapeHTML(site.catelog_name || site.catelog || 'Uncategorized');
        const cardInitial = escapeHTML((rawName.trim().charAt(0) || 'U').toUpperCase());
        
        const logoHtml = site.logo 
             ? `<img src="${escapeHTML(site.logo)}" alt="${safeName}" class="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700" decoding="async" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');">
                <div class="hidden w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`
             : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`;
        
        const hasValidUrl = !!safeUrl;
        const safeHref = hasValidUrl ? safeUrl : '#';
        const categoryHtml = useCompactCard ? '' : `
                <span class="inline-flex items-center px-2 py-0.5 mt-1 rounded-full text-xs font-medium bg-secondary-100 text-primary-700 dark:bg-secondary-800 dark:text-primary-300">
                  ${safeCatalog}
                </span>`;
        
        const frostedClass = isFrostedEnabled ? 'frosted-glass-effect' : '';
        const cardStyleClass = cardStyle === 'style2' ? 'style-2' : '';
        const baseCardClass = isFrostedEnabled
            ? 'site-card group overflow-hidden transition-all' 
            : 'site-card group bg-white border border-primary-100/60 shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700';
        
        const card = document.createElement('div');
        card.className = `${baseCardClass} ${frostedClass} ${cardStyleClass} card-anim-enter`;
        const delay = Math.min(index, 20) * 30;
        if (delay > 0) {
            card.style.animationDelay = `${delay}ms`;
        }
        
        // Remove animation class after completion to ensure clean state
        card.addEventListener('animationend', () => {
            card.classList.remove('card-anim-enter');
            card.style.animation = 'none'; // 褰诲簳绂佺敤鍔ㄧ敾锛岄槻姝㈠共鎵?Hover
            if (delay > 0) card.style.removeProperty('animation-delay');
        }, { once: true });
        
        const catalogId = String(site.catelog_id ?? '').trim();
        card.setAttribute('data-name', safeName);
        card.setAttribute('data-url', safeUrl);
        card.setAttribute('data-catalog', safeCatalog);
        if (catalogId) {
            card.setAttribute('data-catalog-id', catalogId);
        } else {
            card.removeAttribute('data-catalog-id');
        }
        card.setAttribute('data-desc', safeDesc);
        card.setAttribute('data-id', String(site.id || ''));
        
        card.innerHTML = `
        <div class="site-card-content">
          <a href="${safeHref}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
            <div class="flex items-center">
              <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300">
                ${logoHtml}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="site-title text-base font-medium text-gray-900 truncate transition-all duration-300 origin-left" title="${safeName}">${safeName}</h3>
                ${categoryHtml}
              </div>
            </div>
          </a>
        </div>
        `;
        
        sitesGrid.appendChild(card);
      });
      groupRenderedCards();
      filterVisibleCards(currentSearchKeyword);
  }

  function updateNavigationState(catalogId) {
      const allLinks = document.querySelectorAll('#horizontalCategoryNav a.nav-btn');
      allLinks.forEach((link) => {
          const linkId = String(link.getAttribute('data-id') || '').trim();
          const isActive = (!catalogId && !linkId) || (linkId && String(linkId) === String(catalogId));
          if (isActive) {
              link.classList.remove('inactive');
              link.classList.add('active', 'nav-item-active');
          } else {
              link.classList.remove('active', 'nav-item-active');
              link.classList.add('inactive');
          }
      });

      if (!catalogId) {
          const allBtn = document.querySelector('#horizontalCategoryNav a[href="?catalog=all"]');
          if (allBtn) {
              allBtn.classList.remove('inactive');
              allBtn.classList.add('active', 'nav-item-active');
          }
      }
  }

  // 杈呭姪鍑芥暟
  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  
  function normalizeUrl(url) {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return 'https://' + url;
  }

  // Always reset to "All categories" whenever the page is (re)shown.
  function stripCatalogParamFromUrl() {
      const currentUrl = new URL(window.location.href);
      let changed = false;

      if (currentUrl.searchParams.has('catalog')) {
          currentUrl.searchParams.delete('catalog');
          changed = true;
      }
      if (currentUrl.hash) {
          currentUrl.hash = '';
          changed = true;
      }

      if (changed) {
          history.replaceState(null, '', `${currentUrl.pathname}${currentUrl.search}`);
      }
  }

  function resetCatalogViewToAll(options = {}) {
      const shouldResetScroll = options.withScrollReset !== false;
      stripCatalogParamFromUrl();
      const visibleCount = ensureAllSitesRenderedForGroupedView();
      updateHeading(currentSearchKeyword, null, visibleCount);
      updateNavigationState(null);
      if (shouldResetScroll) {
          resetScrollToTop();
      }
  }

  resetCatalogViewToAll({ withScrollReset: true });
  window.addEventListener('load', () => resetCatalogViewToAll({ withScrollReset: true }), { once: true });
  window.addEventListener('pageshow', () => resetCatalogViewToAll({ withScrollReset: true }));
  window.addEventListener('popstate', () => resetCatalogViewToAll({ withScrollReset: true }));
  window.addEventListener('pagehide', forceScrollTopNow);
  window.addEventListener('beforeunload', forceScrollTopNow);
  // Theme Toggle + Time Auto Mode
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeConfig = window.IORI_LAYOUT_CONFIG || {};
  const parseThemeHour = (value, fallback) => {
      const parsed = Number.parseInt(String(value ?? ''), 10);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 23) {
          return fallback;
      }
      return parsed;
  };
  const DEFAULT_THEME_MODE = String(themeConfig.themeMode || 'auto').toLowerCase() === 'manual' ? 'manual' : 'auto';
  const THEME_AUTO_DARK_START = parseThemeHour(themeConfig.themeAutoDarkStart, 19);
  const THEME_AUTO_DARK_END = parseThemeHour(themeConfig.themeAutoDarkEnd, 7);

  function getThemeMode() {
      const stored = localStorage.getItem('theme_mode');
      if (stored === 'auto' || stored === 'manual') {
          return stored;
      }
      return DEFAULT_THEME_MODE;
  }

  function getAutoTheme() {
      const hour = new Date().getHours();
      return (hour >= THEME_AUTO_DARK_START || hour < THEME_AUTO_DARK_END) ? 'dark' : 'light';
  }

  function resolveTheme() {
      if (getThemeMode() === 'auto') {
          return getAutoTheme();
      }
      return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
      if (theme === 'dark') {
          document.documentElement.classList.add('dark');
      } else {
          document.documentElement.classList.remove('dark');
      }
      document.documentElement.dataset.themeMode = getThemeMode();
  }

  function applyResolvedTheme() {
      applyTheme(resolveTheme());
  }

  applyResolvedTheme();
  setInterval(() => {
      if (getThemeMode() === 'auto') {
          applyResolvedTheme();
      }
  }, 60000);

  document.addEventListener('visibilitychange', () => {
      if (!document.hidden && getThemeMode() === 'auto') {
          applyResolvedTheme();
      }
  });

  if (themeToggleBtn) {
      themeToggleBtn.title = '切换主题（双击恢复自动）';

      themeToggleBtn.addEventListener('click', () => {
          const isDark = document.documentElement.classList.contains('dark');
          const nextState = isDark ? 'light' : 'dark';

          const updateTheme = () => {
              localStorage.setItem('theme_mode', 'manual');
              localStorage.setItem('theme', nextState);
              applyTheme(nextState);
          };

          if (!document.startViewTransition) {
              updateTheme();
              return;
          }

          document.documentElement.classList.add('theme-animating');
          const transition = document.startViewTransition(() => {
              updateTheme();
          });
          
          transition.finished.finally(() => {
              document.documentElement.classList.remove('theme-animating');
          });
      });

      themeToggleBtn.addEventListener('dblclick', (event) => {
          event.preventDefault();
          localStorage.setItem('theme_mode', 'auto');
          applyResolvedTheme();
          showToast('Switched back to auto theme mode.');
      });
  }

  // ========== Random Wallpaper Logic (Client-side) ==========
  (async function() {
      const config = window.IORI_LAYOUT_CONFIG || {};
      if (!config.randomWallpaper) return;

      const bgContainer = document.getElementById('fixed-background');
      if (!bgContainer) return;

      const img = bgContainer.querySelector('img');
      // Get current index from cookie
      const match = document.cookie.match(/wallpaper_index=(\d+)/);
      const currentIndex = match ? parseInt(match[1]) : -1;

      try {
          const params = new URLSearchParams({
              source: config.wallpaperSource || 'bing',
              cid: config.wallpaperCid360 || '36',
              country: config.bingCountry || '',
              index: currentIndex
          });

          const res = await fetch(`/api/wallpaper?${params.toString()}`);
          if (res.ok) {
              const data = await res.json();
              if (data.code === 200 && data.data && data.data.url) {
                  const newUrl = data.data.url;
                  const newIndex = data.data.index;

                  // Preload image
                  const newImg = new Image();
                  newImg.src = newUrl;
                  newImg.onload = () => {
                      if (img) {
                          img.classList.add('wallpaper-image');
                          img.style.transition = 'opacity 0.5s ease-in-out';
                          img.style.opacity = '0';
                          setTimeout(() => {
                              img.src = newUrl;
                              img.style.opacity = '1';
                          }, 500);
                      } else {
                          // If no img tag exists (e.g. initial solid color), create one
                          const blurValue = config.enableBgBlur ? Number(config.bgBlurIntensity) || 0 : 0;
                          const blurStyle = blurValue > 0 ? `filter: blur(${blurValue}px); transform: scale(1.02);` : 'transform: scale(1);';
                          bgContainer.innerHTML = `<img class="wallpaper-image" src="${newUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover; object-position: center center; ${blurStyle} opacity: 0; transition: opacity 0.5s ease-in-out;" />`;
                          setTimeout(() => {
                              bgContainer.querySelector('img').style.opacity = '1';
                          }, 50);
                      }
                      
                      // Update cookie for next rotation
                      document.cookie = `wallpaper_index=${newIndex}; path=/; max-age=31536000; SameSite=Lax`;
                  };
              }
          }
      } catch (e) {
          console.error('Failed to fetch random wallpaper:', e);
      }
  })();
});
