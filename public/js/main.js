document.addEventListener('DOMContentLoaded', function() {
  // ========== 侧边栏控制 ==========
  const sidebar = document.getElementById('sidebar');
  const mobileOverlay = document.getElementById('mobileOverlay');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const closeSidebar = document.getElementById('closeSidebar');
  
  function openSidebar() {
    sidebar?.classList.add('open');
    mobileOverlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  
  function closeSidebarMenu() {
    sidebar?.classList.remove('open');
    mobileOverlay?.classList.remove('open');
    document.body.style.overflow = '';
  }
  
  sidebarToggle?.addEventListener('click', openSidebar);
  closeSidebar?.addEventListener('click', closeSidebarMenu);
  mobileOverlay?.addEventListener('click', closeSidebarMenu);
  
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
  
  // ========== 复制链接功能 ==========
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const url = this.getAttribute('data-url');
      if (!url) return;
      
      navigator.clipboard.writeText(url).then(() => {
        showCopySuccess(this);
      }).catch(() => {
        // 备用方法
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
          showCopySuccess(this);
        } catch (e) {
          alert('复制失败,请手动复制');
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
  
  // ========== 返回顶部 ==========
  const backToTop = document.getElementById('backToTop');
  
  window.addEventListener('scroll', function() {
    if (window.pageYOffset > 300) {
      backToTop?.classList.remove('opacity-0', 'invisible');
    } else {
      backToTop?.classList.add('opacity-0', 'invisible');
    }
  });
  
  backToTop?.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  // ========== 模态框控制 ==========
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
  
  // ========== 表单提交 ==========
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
        showToast('提交成功,等待管理员审核');
        closeModal();
        addSiteForm.reset();
      } else {
        alert(data.message || '提交失败');
      }
    })
    .catch(err => {
      console.error('网络错误:', err);
      alert('网络错误,请稍后重试');
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
  
  // ========== 搜索功能 ==========
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
      heading.textContent = isMobile ? `${visibleCount} 个书签` : `搜索结果 · ${visibleCount} 个书签`;
    } else {
      const currentActive = heading.dataset.active;
      if (isMobile) {
          heading.textContent = `${visibleCount} 个书签`;
      } else {
          if (currentActive) {
              heading.textContent = `${currentActive} · ${visibleCount} 个书签`;
          } else {
              heading.textContent = `全部收藏 · ${visibleCount} 个书签`;
          }
      }
    }
  }

  // 初次加载时根据屏幕宽度修正标题显示
  updateHeading();
  groupRenderedCards();
  
  // ========== 一言 API ==========
  const hitokotoContainer = document.querySelector('#hitokoto').parentElement;
  // 检查容器是否被隐藏，如果隐藏则不发起请求
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

  // ========== Horizontal Menu Overflow Logic ==========
  const navContainer = document.getElementById('horizontalCategoryNav');
  const moreWrapper = document.getElementById('horizontalMoreWrapper');
  const moreBtn = document.getElementById('horizontalMoreBtn');
  const dropdown = document.getElementById('horizontalMoreDropdown');
  
  // Define these globally within the scope so updateNavigationState can use them
  let checkOverflow = () => {};
  let resetNav = () => {};

  if (navContainer && moreWrapper && moreBtn && dropdown) {
    resetNav = () => {
        const dropdownItems = Array.from(dropdown.children);
        dropdownItems.forEach(item => {
            if (item.dataset.originalClass) item.className = item.dataset.originalClass;
            const link = item.querySelector('a');
            if (link && link.dataset.originalClass) link.className = link.dataset.originalClass;
            navContainer.insertBefore(item, moreWrapper);
        });
        moreWrapper.classList.add('hidden');
        moreBtn.classList.remove('active', 'text-primary-600', 'bg-secondary-100');
        moreBtn.classList.add('inactive');
    };

    checkOverflow = () => {
        resetNav();
        
        // Filter visible category items (exclude moreWrapper which is hidden now)
        // Actually moreWrapper is child of navContainer.
        const navChildren = Array.from(navContainer.children).filter(el => el !== moreWrapper);
        
        if (navChildren.length === 0) return;
        
        const firstTop = navChildren[0].offsetTop;
        const lastItem = navChildren[navChildren.length - 1];
        
        // Check if last item wraps
        if (lastItem.offsetTop === firstTop) {
            // No wrapping even for the last item -> All fit!
            navContainer.style.overflow = 'visible';
            return;
        }
        
        // Wrapping detected! Show the "More" button to participate in layout
        moreWrapper.classList.remove('hidden');
        
        // Loop to move items to dropdown until everything fits on one line
        // We check if "moreWrapper" (which is now the last item) wraps.
        // Or if the item before it wraps.
        while (true) {
             // Current visible items (categories)
             const currentCategories = Array.from(navContainer.children).filter(el => el !== moreWrapper && el.style.display !== 'none');
             
             if (currentCategories.length === 0) break; // Should not happen
             
             const lastCategory = currentCategories[currentCategories.length - 1];
             
             // Check condition: Does "moreWrapper" wrap? Or does "lastCategory" wrap?
             // (We want everything on the first line)
             const moreWrapperWraps = moreWrapper.offsetTop > firstTop;
             const lastCategoryWraps = lastCategory.offsetTop > firstTop;
             
             if (!moreWrapperWraps && !lastCategoryWraps) {
                 // Fits!
                 break;
             }
             
             // Doesn't fit. Move lastCategory to dropdown.
             // Prepend to maintain order (4, 5 -> [5] -> [4, 5])
             
             // Save wrapper class
             if (!lastCategory.dataset.originalClass) {
                 lastCategory.dataset.originalClass = lastCategory.className;
             }
            
             // Wrapper becomes a block item in dropdown
             lastCategory.className = 'menu-item-wrapper block w-full relative';
            
             // Adjust inner link style
             const link = lastCategory.querySelector('a');
             if (link) {
                 link.dataset.originalClass = link.className;
                 const isActive = link.classList.contains('active');
                 link.className = 'dropdown-item w-full text-left px-4 py-2 text-sm';
                 if (isActive) link.classList.add('active');
             }
             
             dropdown.insertBefore(lastCategory, dropdown.firstChild);
        }

        // Check if any item in dropdown is active and highlight More button
        const activeInDropdown = dropdown.querySelector('.active');
        if (activeInDropdown) {
             moreBtn.classList.add('active');
             moreBtn.classList.remove('inactive');
             moreBtn.classList.add('text-primary-600', 'bg-secondary-100');
        }

        // Restore overflow to visible to allow dropdowns (submenus) to show
        navContainer.style.overflow = 'visible';
    };

    // Initial check
    setTimeout(checkOverflow, 100);
    window.addEventListener('resize', () => {
        // Debounce
        clearTimeout(window.resizeTimer);
        window.resizeTimer = setTimeout(checkOverflow, 100);
    });

    // Toggle Dropdown
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.contains('hidden');
        if (isHidden) {
            dropdown.classList.remove('hidden');
            document.body.classList.add('menu-open');
        } else {
            dropdown.classList.add('hidden');
            document.body.classList.remove('menu-open');
        }
    });

    // Close on click inside dropdown
    dropdown.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            dropdown.classList.add('hidden');
            document.body.classList.remove('menu-open');
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !moreBtn.contains(e.target)) {
            dropdown.classList.add('hidden');
            document.body.classList.remove('menu-open');
        }
    });
  }

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
      const targetTop = targetSection.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });

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
    const link = e.target.closest('a[href^="?catalog="]');
    if (!link) return;
    
    // Allow new tab clicks
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    const href = link.getAttribute('href');
    const catalogId = String(link.getAttribute('data-id') || '').trim();
    const catalogName = link.textContent.trim();
    
    if (typeof closeSidebarMenu === 'function') {
        closeSidebarMenu();
    }

    if (!sitesGrid || !Array.isArray(window.IORI_SITES)) {
        window.location.href = href;
        return;
    }

    const visibleCount = ensureAllSitesRenderedForGroupedView();
    const config = window.IORI_LAYOUT_CONFIG || {};

    if (!catalogId) {
        updateNavigationState(null);
        updateHeading(currentSearchKeyword, null, visibleCount);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        updateNavigationState(catalogId);
        const targetSection = locateCategoryGroup(catalogId, catalogName);
        const groupVisibleCount = targetSection
            ? targetSection.querySelectorAll('.site-card:not(.hidden)').length
            : visibleCount;
        updateHeading(currentSearchKeyword, catalogName || null, groupVisibleCount);
    }

    // In grouped-home mode, remember the last located group id.
    if (config.rememberLastCategory) {
        const rememberValue = catalogId ? String(catalogId) : 'all';
        localStorage.setItem('iori_last_category', rememberValue);
        setCookie('iori_last_category', rememberValue, 365);
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
      document.querySelectorAll('#horizontalCategoryNav a[data-id], #sidebar a[data-id]').forEach(link => {
          const id = String(link.getAttribute('data-id') || '').trim();
          if (!id || orderMap.has(id)) return;
          orderMap.set(id, order++);
      });
      return orderMap;
  }

  function findCatalogIdByName(name) {
      const normalizedName = String(name || '').trim();
      if (!normalizedName) return '';
      const links = document.querySelectorAll('#horizontalCategoryNav a[data-id], #sidebar a[data-id], a[data-id]');
      for (const link of links) {
          const text = String(link.textContent || '').replace(/\s+/g, ' ').trim();
          if (text === normalizedName) {
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
          const groupName = String(card.dataset.catalog || '').trim() || '未分类';
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
      
      // 使用全局配置获取布局设置，避免依赖 DOM 推断
      const config = window.IORI_LAYOUT_CONFIG || {};
      const isFiveCols = config.gridCols === '5';
      const isSixCols = config.gridCols === '6';
      const hideDesc = config.hideDesc === true;
      const hideLinks = config.hideLinks === true;
      const hideCategory = config.hideCategory === true;
      const cardStyle = config.cardStyle || 'style1';
      
      // 优先从配置获取毛玻璃开关状态，CSS 变量作为回退
      const computedStyle = getComputedStyle(document.documentElement);
      const frostedBlurVal = computedStyle.getPropertyValue('--frosted-glass-blur').trim();
      const isFrostedEnabled = config.enableFrostedGlass !== undefined 
          ? config.enableFrostedGlass 
          : (frostedBlurVal !== '');
      
      sitesGrid.innerHTML = '';
      
      if (sites.length === 0) {
          sitesGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-10">本分类下暂无书签</div>';
          return;
      }

      sites.forEach((site, index) => {
        const rawName = String(site.name || '未命名');
        const safeName = escapeHTML(rawName);
        const safeUrl = normalizeUrl(site.url);
        const safeDesc = escapeHTML(site.desc || '暂无描述');
        const safeCatalog = escapeHTML(site.catelog_name || site.catelog || '未分类');
        const cardInitial = escapeHTML((rawName.trim().charAt(0) || '站').toUpperCase());
        
        const logoHtml = site.logo 
             ? `<img src="${escapeHTML(site.logo)}" alt="${safeName}" class="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-gray-700" decoding="async" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');">
                <div class="hidden w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`
             : `<div class="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white font-semibold text-lg shadow-inner">${cardInitial}</div>`;
        
        const descHtml = hideDesc ? '' : `<p class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2" title="${safeDesc}">${safeDesc}</p>`;
        
        const hasValidUrl = !!safeUrl;
        const linksHtml = hideLinks ? '' : `
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-primary-600 dark:text-primary-400 truncate flex-1 min-w-0 mr-2" title="${safeUrl}">${safeUrl || '未提供链接'}</span>
            <button class="copy-btn relative flex items-center px-2 py-1 ${hasValidUrl ? 'bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-300 dark:hover:bg-accent-900/50' : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'} rounded-full text-xs font-medium transition-colors" data-url="${safeUrl}" ${hasValidUrl ? '' : 'disabled'}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 ${isFiveCols || isSixCols ? '' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              ${isFiveCols || isSixCols ? '' : '<span class="copy-text">复制</span>'}
              <span class="copy-success hidden absolute -top-8 right-0 bg-accent-500 text-white text-xs px-2 py-1 rounded shadow-md">已复制!</span>
            </button>
          </div>`;
          
        const categoryHtml = hideCategory ? '' : `
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
            card.style.animation = 'none'; // 彻底禁用动画，防止干扰 Hover
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
          <a href="${safeUrl}" ${hasValidUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="block">
            <div class="flex items-start">
              <div class="site-icon flex-shrink-0 mr-4 transition-all duration-300">
                ${logoHtml}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="site-title text-base font-medium text-gray-900 truncate transition-all duration-300 origin-left" title="${safeName}">${safeName}</h3>
                ${categoryHtml}
              </div>
            </div>
            ${descHtml}
          </a>
          ${linksHtml}
        </div>
        `;
        
        sitesGrid.appendChild(card);
        
        const copyBtn = card.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const url = this.getAttribute('data-url');
                if (!url) return;
                
                navigator.clipboard.writeText(url).then(() => {
                    showCopySuccess(this);
                }).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = url;
                    textarea.style.position = 'fixed';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try { document.execCommand('copy'); showCopySuccess(this); } catch (e) {}
                    document.body.removeChild(textarea);
                });
            });
        }
      });
      groupRenderedCards();
      filterVisibleCards(currentSearchKeyword);
  }

  function updateNavigationState(catalogId) {
      // 1. Update states on standard nav items (in main container and dropdown)
      // 注意：不再调用 resetNav() 以避免打断用户交互
      const allLinks = document.querySelectorAll('a.nav-btn, a.dropdown-item');
      allLinks.forEach(link => {
          const linkId = link.getAttribute('data-id');
          const isActive = (!catalogId && !linkId) || (String(linkId) === String(catalogId));
          
          if (isActive) {
              link.classList.remove('inactive');
              link.classList.add('active', 'nav-item-active');
          } else {
              link.classList.remove('active', 'nav-item-active');
              link.classList.add('inactive');
          }
          // 保存状态，供 checkOverflow 恢复使用
          link.dataset.originalClass = link.className;
      });

      // 2. Parent highlighting
      const navContainer = document.getElementById('horizontalCategoryNav');
      if (navContainer) {
          const topWrappers = Array.from(navContainer.children);
          topWrappers.forEach(wrapper => {
              const topLink = wrapper.querySelector(':scope > a.nav-btn'); 
              if (!topLink) return;
              
              const topLinkId = topLink.getAttribute('data-id');
              // 如果顶级项不是当前分类，检查其子项是否有匹配
              if (String(topLinkId) !== String(catalogId)) {
                  const subLink = wrapper.querySelector(`a[data-id="${catalogId}"]`);
                  if (subLink) {
                      topLink.classList.remove('inactive');
                      topLink.classList.add('active', 'nav-item-active');
                      topLink.dataset.originalClass = topLink.className;
                  }
              }
          });
      }
      
      // 3. Highlight "More" button if active category is inside dropdown
      if (dropdown && moreBtn) {
          const activeInDropdown = dropdown.querySelector('.active');
          if (activeInDropdown) {
               moreBtn.classList.add('active', 'text-primary-600', 'bg-secondary-100');
               moreBtn.classList.remove('inactive');
          } else {
               moreBtn.classList.remove('active', 'text-primary-600', 'bg-secondary-100');
               moreBtn.classList.add('inactive');
          }
      }

      // 4. Highlight "All" button explicitly if no catalogId provided (means "All")
      if (!catalogId) {
          const allBtn = document.querySelector('a[href="?catalog=all"]');
          if (allBtn) {
              allBtn.classList.remove('inactive');
              allBtn.classList.add('active', 'nav-item-active');
          }
      }
      
      // Update Sidebar (Vertical Menu)
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
          const links = sidebar.querySelectorAll('a[data-id], a[href="?catalog=all"]');
          links.forEach(link => {
               const svg = link.querySelector('svg');
               const linkId = link.getAttribute('data-id');
               const isActive = (!catalogId && !linkId) || (String(linkId) === String(catalogId));

               if (isActive) {
                   // Active state
                   link.classList.remove('hover:bg-gray-100', 'text-gray-700', 'dark:hover:bg-gray-800', 'dark:text-gray-300');
                   link.classList.add('bg-secondary-100', 'text-primary-700', 'dark:bg-gray-800', 'dark:text-primary-400');
                   
                   if (svg) {
                       svg.classList.remove('text-gray-400', 'dark:text-gray-500');
                       svg.classList.add('text-primary-600', 'dark:text-primary-400');
                   }
               } else {
                   // Inactive state
                   link.classList.remove('bg-secondary-100', 'text-primary-700', 'dark:bg-gray-800', 'dark:text-primary-400');
                   link.classList.add('hover:bg-gray-100', 'text-gray-700', 'dark:text-gray-300', 'dark:hover:bg-gray-800');
                   
                   if (svg) {
                       svg.classList.remove('text-primary-600', 'dark:text-primary-400');
                       svg.classList.add('text-gray-400', 'dark:text-gray-500');
                   }
               }
          });
      }
  }

  // 辅助函数
  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  
  function normalizeUrl(url) {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return 'https://' + url;
  }

  // Auto-restore Last Category
  (function() {
      const config = window.IORI_LAYOUT_CONFIG || {};
      const urlParams = new URLSearchParams(window.location.search);
      const hasCatalogParam = urlParams.has('catalog');

      if (hasCatalogParam) return;

      const visibleCount = ensureAllSitesRenderedForGroupedView();

      if (!config.rememberLastCategory) {
          updateHeading(currentSearchKeyword, null, visibleCount);
          updateNavigationState(null);
          return;
      }

      let lastId = localStorage.getItem('iori_last_category');
      if (!lastId) {
          const match = document.cookie.match(/iori_last_category=(all|\d+)/);
          if (match) {
              lastId = match[1];
          }
      }

      if (!lastId || lastId === 'all') {
          updateHeading(currentSearchKeyword, null, visibleCount);
          updateNavigationState(null);
          return;
      }

      const link = document.querySelector(`a[data-id="${lastId}"]`);
      if (!link) {
          localStorage.removeItem('iori_last_category');
          updateHeading(currentSearchKeyword, null, visibleCount);
          updateNavigationState(null);
          return;
      }

      const catalogName = link.innerText.trim();
      updateNavigationState(lastId);
      const targetSection = locateCategoryGroup(lastId, catalogName);
      const groupVisibleCount = targetSection
          ? targetSection.querySelectorAll('.site-card:not(.hidden)').length
          : visibleCount;
      updateHeading(currentSearchKeyword, catalogName, groupVisibleCount);
  })();

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
          showToast('已恢复自动主题模式');
      });
  }

  // ========== Mobile Keyboard Background Stability ==========
  (function() {
      const bgContainer = document.getElementById('fixed-background');
      if (!bgContainer || !window.visualViewport) return;

      const syncBackgroundOffset = () => {
          const offsetTop = Math.max(window.visualViewport.offsetTop || 0, 0);
          if (offsetTop > 0) {
              bgContainer.style.transform = `translate3d(0, ${offsetTop}px, 0)`;
          } else {
              bgContainer.style.removeProperty('transform');
          }
      };

      window.visualViewport.addEventListener('resize', syncBackgroundOffset);
      window.visualViewport.addEventListener('scroll', syncBackgroundOffset);
      window.addEventListener('orientationchange', () => setTimeout(syncBackgroundOffset, 120));
      syncBackgroundOffset();
  })();

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
                          img.style.transition = 'opacity 0.5s ease-in-out';
                          img.style.opacity = '0';
                          setTimeout(() => {
                              img.src = newUrl;
                              img.style.opacity = '1';
                          }, 500);
                      } else {
                          // If no img tag exists (e.g. initial solid color), create one
                          bgContainer.innerHTML = `<img src="${newUrl}" alt="" style="width: 100%; height: 100%; object-fit: cover; filter: blur(${config.enableBgBlur ? config.bgBlurIntensity : 0}px); transform: scale(1.02); opacity: 0; transition: opacity 0.5s ease-in-out;" />`;
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
