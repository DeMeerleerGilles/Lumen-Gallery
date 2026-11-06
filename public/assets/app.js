// Lumen Gallery - Interactive Application Core

(function () {
  'use strict';

  // --- 1. Preference Management ---
  const PREF_KEY = 'lumen-gallery-preferences';
  const savedPrefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
  const root = document.documentElement;

  function setPref(key, val) {
    savedPrefs[key] = val;
    localStorage.setItem(PREF_KEY, JSON.stringify(savedPrefs));
  }

  function applyPreferences() {
    root.dataset.theme = savedPrefs.theme || 'dark';
    root.dataset.density = savedPrefs.density || 'spacious';
    root.dataset.labels = savedPrefs.labels === false ? 'hidden' : 'visible';
    root.dataset.gps = savedPrefs.gps === false ? 'hidden' : 'visible';

    const themeSelect = document.getElementById('theme-choice');
    const densitySelect = document.getElementById('density-choice');
    const labelsCheck = document.getElementById('labels-choice');
    const gpsCheck = document.getElementById('gps-choice');

    if (themeSelect) themeSelect.value = root.dataset.theme;
    if (densitySelect) densitySelect.value = root.dataset.density;
    if (labelsCheck) labelsCheck.checked = root.dataset.labels !== 'hidden';
    if (gpsCheck) gpsCheck.checked = root.dataset.gps !== 'hidden';
  }

  applyPreferences();

  // Settings Dialog Listeners
  const settingsDialog = document.getElementById('settings');
  document.getElementById('settings-toggle')?.addEventListener('click', () => settingsDialog?.showModal());
  document.getElementById('close-settings')?.addEventListener('click', () => settingsDialog?.close());

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    setPref('theme', next);
    applyPreferences();
    updateMapTheme();
  });

  document.getElementById('theme-choice')?.addEventListener('change', (e) => {
    setPref('theme', e.target.value);
    applyPreferences();
    updateMapTheme();
  });

  document.getElementById('density-choice')?.addEventListener('change', (e) => {
    setPref('density', e.target.value);
    applyPreferences();
  });

  document.getElementById('labels-choice')?.addEventListener('change', (e) => {
    setPref('labels', e.target.checked);
    applyPreferences();
  });

  document.getElementById('gps-choice')?.addEventListener('change', (e) => {
    setPref('gps', e.target.checked);
    applyPreferences();
  });

  // --- 2. Toast Notifications ---
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Global search input redirects/filters
  const globalSearch = document.getElementById('global-search');
  if (globalSearch) {
    globalSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.album-card').forEach((card) => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // --- 3. Album View Logic ---
  const albumData = window.LUMEN_ALBUM_DATA;
  if (!albumData) return; // Exit if not in album view

  const albumPath = albumData.album.relativePath;
  const FAVS_KEY = `lumen_favs_${albumPath}`;
  let favorites = new Set(JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'));

  function saveFavorites() {
    localStorage.setItem(FAVS_KEY, JSON.stringify(Array.from(favorites)));
    updateFavoritesUI();
  }

  function updateFavoritesUI() {
    // Update card heart buttons
    document.querySelectorAll('.fav-btn').forEach((btn) => {
      const fn = btn.dataset.filename;
      if (favorites.has(fn)) {
        btn.classList.add('favorited');
      } else {
        btn.classList.remove('favorited');
      }
    });

    // Update floating proofing tray
    const tray = document.getElementById('proofing-tray');
    const trayText = document.getElementById('tray-count-text');
    if (tray && trayText) {
      if (favorites.size > 0) {
        trayText.textContent = `${favorites.size} photo${favorites.size === 1 ? '' : 's'} selected`;
        tray.classList.remove('hidden');
      } else {
        tray.classList.add('hidden');
      }
    }

    // Update filter toggle text if active
    const favToggleBtn = document.getElementById('favorites-filter-toggle');
    if (favToggleBtn) {
      const label = favToggleBtn.querySelector('.fav-filter-text');
      if (label) {
        label.textContent = favorites.size > 0 ? `Favorites (${favorites.size})` : 'Favorites';
      }
    }
  }

  // Toggle favorite on card heart click
  document.querySelectorAll('.fav-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const fn = btn.dataset.filename;
      if (favorites.has(fn)) {
        favorites.delete(fn);
        showToast(`Removed ${fn} from selections`);
      } else {
        favorites.add(fn);
        showToast(`Added ${fn} to selections`);
      }
      saveFavorites();
    });
  });

  // Proofing Tray Actions
  document.getElementById('tray-copy-names')?.addEventListener('click', () => {
    const list = Array.from(favorites).join(', ');
    navigator.clipboard.writeText(list).then(() => {
      showToast(`Copied ${favorites.size} filenames to clipboard!`);
    });
  });

  document.getElementById('tray-clear')?.addEventListener('click', () => {
    favorites.clear();
    saveFavorites();
    showToast('Selections cleared.');
    applyPhotoFilters();
  });

  document.getElementById('tray-download-selected')?.addEventListener('click', async () => {
    if (favorites.size === 0) return;
    showToast('Preparing ZIP download...');
    try {
      const response = await fetch('/api/photos/download-selected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumPath,
          filenames: Array.from(favorites)
        })
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${albumData.album.name}_selected.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast('Error downloading selected photos.');
    }
  });

  // --- 4. Filtering and Sorting ---
  let showOnlyFavorites = false;
  const filterInput = document.getElementById('album-filter-input');
  const cameraSelect = document.getElementById('camera-select');
  const sortSelect = document.getElementById('sort-select');
  const favFilterToggle = document.getElementById('favorites-filter-toggle');
  const galleryGrid = document.getElementById('main-gallery-grid');
  const emptyFilter = document.getElementById('empty-filter-state');

  favFilterToggle?.addEventListener('click', () => {
    showOnlyFavorites = !showOnlyFavorites;
    favFilterToggle.classList.toggle('active', showOnlyFavorites);
    applyPhotoFilters();
  });

  filterInput?.addEventListener('input', applyPhotoFilters);
  cameraSelect?.addEventListener('change', applyPhotoFilters);
  sortSelect?.addEventListener('change', applyPhotoSorting);

  document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
    if (filterInput) filterInput.value = '';
    if (cameraSelect) cameraSelect.value = 'all';
    showOnlyFavorites = false;
    favFilterToggle?.classList.remove('active');
    applyPhotoFilters();
  });

  function applyPhotoFilters() {
    const q = filterInput?.value.toLowerCase().trim() || '';
    const selectedCam = cameraSelect?.value || 'all';
    const cards = Array.from(document.querySelectorAll('.photo-card'));
    let visibleCount = 0;

    cards.forEach((card) => {
      const fn = card.dataset.filename.toLowerCase();
      const cam = card.dataset.camera.toLowerCase();
      const isFav = favorites.has(card.dataset.filename);

      let matchesSearch = !q || fn.includes(q) || cam.includes(q);
      let matchesCam = selectedCam === 'all' || card.dataset.camera === selectedCam;
      let matchesFav = !showOnlyFavorites || isFav;

      if (matchesSearch && matchesCam && matchesFav) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (emptyFilter) {
      emptyFilter.classList.toggle('hidden', visibleCount > 0);
    }
  }

  function applyPhotoSorting() {
    const order = sortSelect?.value || 'date-desc';
    const cards = Array.from(document.querySelectorAll('.photo-card'));

    cards.sort((a, b) => {
      if (order === 'name-asc') return a.dataset.filename.localeCompare(b.dataset.filename);
      if (order === 'name-desc') return b.dataset.filename.localeCompare(a.dataset.filename);
      if (order === 'date-asc') return (a.dataset.date || '').localeCompare(b.dataset.date || '');
      return (b.dataset.date || '').localeCompare(a.dataset.date || '');
    });

    cards.forEach((card) => galleryGrid.appendChild(card));
  }

  updateFavoritesUI();

  // --- 5. Interactive Map View (Leaflet) ---
  let leafletMap = null;
  let mapTileLayer = null;

  function updateMapTheme() {
    if (!leafletMap || !window.L) return;
    const isLight = root.dataset.theme === 'light';
    const tileUrl = isLight
      ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

    if (mapTileLayer) leafletMap.removeLayer(mapTileLayer);
    mapTileLayer = window.L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap);
  }

  function initMap() {
    if (leafletMap || !window.L) return;
    const mapCanvas = document.getElementById('album-map');
    if (!mapCanvas) return;

    leafletMap = window.L.map('album-map');
    updateMapTheme();

    const bounds = [];
    albumData.photos.forEach((photo, idx) => {
      const lat = photo.metadata.latitude;
      const lon = photo.metadata.longitude;
      if (typeof lat === 'number' && typeof lon === 'number') {
        bounds.push([lat, lon]);

        const marker = window.L.circleMarker([lat, lon], {
          radius: 9,
          fillColor: '#d9a86c',
          color: '#ffffff',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.9
        }).addTo(leafletMap);

        const locationDesc = photo.metadata.city ? `${photo.metadata.city}, ${photo.metadata.country || ''}` : '';

        const popupContent = `
          <div style="font-family: var(--font-sans); min-width: 140px; color: #111;">
            <img src="${photo.thumbUrl}" alt="" style="width: 100%; height: 90px; object-fit: cover; border-radius: 6px; margin-bottom: 6px;">
            <strong style="display: block; font-size: 0.8rem; word-break: break-all;">${photo.filename}</strong>
            ${locationDesc ? `<span style="font-size: 0.72rem; color: #666; display: block;">📍 ${locationDesc}</span>` : ''}
            <button onclick="window.LUMEN_OPEN_PHOTO(${idx})" style="margin-top: 6px; width: 100%; border: 0; background: #d9a86c; color: #000; font-weight: 700; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">View Photo</button>
          </div>
        `;
        marker.bindPopup(popupContent);
      }
    });

    if (bounds.length > 0) {
      leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }

  // View Switching (Grid ⟷ Map)
  const gridViewBtn = document.getElementById('view-grid-btn');
  const mapViewBtn = document.getElementById('view-map-btn');
  const gridContainer = document.getElementById('grid-view-container');
  const mapContainer = document.getElementById('map-view-container');

  gridViewBtn?.addEventListener('click', () => {
    gridViewBtn.classList.add('active');
    mapViewBtn?.classList.remove('active');
    gridContainer?.classList.remove('hidden');
    mapContainer?.classList.add('hidden');
  });

  mapViewBtn?.addEventListener('click', () => {
    mapViewBtn.classList.add('active');
    gridViewBtn?.classList.remove('active');
    mapContainer?.classList.remove('hidden');
    gridContainer?.classList.add('hidden');
    initMap();
    setTimeout(() => leafletMap?.invalidateSize(), 200);
  });

  // --- 6. Pro Lightbox & Slideshow ---
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCounter = document.getElementById('lightbox-counter');
  const inspectorFilename = document.getElementById('inspector-filename');
  const inspectorPills = document.getElementById('inspector-pills');
  const inspectorMetaList = document.getElementById('inspector-meta-list');
  const filmstrip = document.getElementById('lightbox-filmstrip');
  const favBtnInLightbox = document.getElementById('lightbox-fav');
  const downloadBtnInLightbox = document.getElementById('lightbox-download');
  const slideshowBtn = document.getElementById('lightbox-slideshow');
  const inspectorDrawer = document.getElementById('lightbox-inspector');

  let currentIndex = 0;
  let slideshowTimer = null;

  // Build Filmstrip Thumbnails
  if (filmstrip && albumData.photos) {
    filmstrip.innerHTML = albumData.photos
      .map(
        (p, idx) => `
        <div class="filmstrip-thumb" data-index="${idx}">
          <img src="${p.thumbUrl}" alt="" loading="lazy">
        </div>
      `
      )
      .join('');

    filmstrip.querySelectorAll('.filmstrip-thumb').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const idx = Number(thumb.dataset.index);
        openPhoto(idx);
      });
    });
  }

  function openPhoto(index) {
    if (index < 0) index = albumData.photos.length - 1;
    if (index >= albumData.photos.length) index = 0;
    currentIndex = index;

    const photo = albumData.photos[currentIndex];
    if (!photo) return;

    if (lightboxImg) {
      lightboxImg.src = photo.largeUrl;
      lightboxImg.alt = photo.filename;
    }

    if (lightboxCounter) {
      lightboxCounter.textContent = `${currentIndex + 1} / ${albumData.photos.length}`;
    }

    if (inspectorFilename) {
      inspectorFilename.textContent = photo.filename;
    }

    if (downloadBtnInLightbox) {
      downloadBtnInLightbox.href = photo.largeUrl;
      downloadBtnInLightbox.download = photo.filename;
    }

    // Update Favorite status in Lightbox
    if (favBtnInLightbox) {
      const isFav = favorites.has(photo.filename);
      favBtnInLightbox.classList.toggle('active', isFav);
    }

    // Specs Pills
    if (inspectorPills) {
      const specs = [
        photo.metadata.aperture,
        photo.metadata.shutterSpeed,
        photo.metadata.iso ? `ISO ${photo.metadata.iso}` : null,
        photo.metadata.focalLength,
        photo.metadata.megapixels
      ].filter(Boolean);

      inspectorPills.innerHTML = specs.map((s) => `<span class="spec-pill">${s}</span>`).join('');
    }

    // Full Metadata Description List
    if (inspectorMetaList) {
      const entries = [
        ['Camera', photo.metadata.camera],
        ['Lens', photo.metadata.lens],
        ['Date Taken', photo.metadata.dateTaken ? new Date(photo.metadata.dateTaken).toLocaleString() : null],
        ['Dimensions', photo.width && photo.height ? `${photo.width} × ${photo.height}` : null],
        ['Location', photo.metadata.city ? `${photo.metadata.city}, ${photo.metadata.country || ''}` : photo.metadata.country],
        ['GPS Coordinates', photo.metadata.latitude ? `${photo.metadata.latitude.toFixed(4)}, ${photo.metadata.longitude.toFixed(4)}` : null]
      ].filter(([, val]) => val);

      inspectorMetaList.innerHTML = entries
        .map(([label, val]) => `<dt>${label}</dt><dd>${val}</dd>`)
        .join('');
    }

    // Active Filmstrip Thumb
    filmstrip?.querySelectorAll('.filmstrip-thumb').forEach((thumb, idx) => {
      const isActive = idx === currentIndex;
      thumb.classList.toggle('active', isActive);
      if (isActive) thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });

    if (lightbox && !lightbox.open) {
      lightbox.showModal();
    }
  }

  window.LUMEN_OPEN_PHOTO = openPhoto;

  // Click card to open lightbox
  document.querySelectorAll('.photo-click-target').forEach((target) => {
    target.addEventListener('click', () => {
      const card = target.closest('.photo-card');
      const idx = Number(card.dataset.index);
      openPhoto(idx);
    });
  });

  // Navigation
  document.getElementById('lightbox-prev')?.addEventListener('click', () => openPhoto(currentIndex - 1));
  document.getElementById('lightbox-next')?.addEventListener('click', () => openPhoto(currentIndex + 1));
  document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);

  // Toggle favorite from inside lightbox
  favBtnInLightbox?.addEventListener('click', () => {
    const photo = albumData.photos[currentIndex];
    if (!photo) return;
    if (favorites.has(photo.filename)) {
      favorites.delete(photo.filename);
      favBtnInLightbox.classList.remove('active');
      showToast(`Removed ${photo.filename} from selections`);
    } else {
      favorites.add(photo.filename);
      favBtnInLightbox.classList.add('active');
      showToast(`Added ${photo.filename} to selections`);
    }
    saveFavorites();
  });

  // Toggle Info Inspector
  document.getElementById('lightbox-info-toggle')?.addEventListener('click', () => {
    inspectorDrawer?.classList.toggle('collapsed');
  });

  // Fullscreen
  document.getElementById('lightbox-fullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      lightbox?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Slideshow
  function toggleSlideshow() {
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
      slideshowBtn?.classList.remove('active');
      showToast('Slideshow paused');
    } else {
      slideshowBtn?.classList.add('active');
      showToast('Slideshow started (3.5s interval)');
      slideshowTimer = setInterval(() => {
        openPhoto(currentIndex + 1);
      }, 3500);
    }
  }

  slideshowBtn?.addEventListener('click', toggleSlideshow);

  function closeLightbox() {
    if (slideshowTimer) {
      clearInterval(slideshowTimer);
      slideshowTimer = null;
      slideshowBtn?.classList.remove('active');
    }
    lightbox?.close();
  }

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (!lightbox?.open) return;
    if (e.key === 'ArrowRight') openPhoto(currentIndex + 1);
    if (e.key === 'ArrowLeft') openPhoto(currentIndex - 1);
    if (e.key === 'Escape') closeLightbox();
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      toggleSlideshow();
    }
    if (e.key === 'f' || e.key === 'F') {
      if (!document.fullscreenElement) lightbox.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    }
    if (e.key === 'i' || e.key === 'I') {
      inspectorDrawer?.classList.toggle('collapsed');
    }
  });

  // Touch Swipe for Mobile
  let touchStartX = 0;
  lightbox?.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lightbox?.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 50) {
      if (diff < 0) openPhoto(currentIndex + 1);
      else openPhoto(currentIndex - 1);
    }
  }, { passive: true });
})();
