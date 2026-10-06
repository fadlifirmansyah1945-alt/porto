// Portfolio data lives in this browser. The starter albums reappear if local data is cleared.
const STORAGE_KEY = 'fira-gallery-data-v1';
const CLOUD_TABLE = 'portfolio_data';
const PROFILE_TABLE = 'public_profiles';
const FOLLOW_TABLE = 'account_follows';
const NOTIFICATION_TABLE = 'account_notifications';
const cloudConfig = window.PORTFOLIO_SUPABASE_CONFIG || {};
const supabaseClient = window.supabase && cloudConfig.url && cloudConfig.anonKey
  ? window.supabase.createClient(cloudConfig.url, cloudConfig.anonKey)
  : null;
const PUBLIC_PROFILE = {
  name: 'Muhamad Fadli Firmansyah',
  picture: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=260&h=300&q=85',
  role: 'Siswa · Desain Komunikasi Visual',
  school: 'SMKN 1 Kota Serang',
  bio: 'Saya Muhamad Fadli Firmansyah, siswa Desain Komunikasi Visual di SMKN 1 Kota Serang. Portfolio ini menjadi ruang untuk menyimpan karya dan proses belajar saya di bidang desain komunikasi visual.',
  interests: ['Affinity', 'Fotografi', 'Editing', 'VS Code']
};
const STARTER_DATA = {
  albums: [
    { id: 'album-brand', name: 'Identitas Visual', description: 'Eksplorasi bentuk, warna, dan karakter untuk identitas yang terasa dekat.', category: 'Branding', createdAt: '2026-02-12', cover: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=85' },
    { id: 'album-digital', name: 'Ruang Digital', description: 'Pengalaman digital yang dirancang agar terasa jernih, ramah, dan mudah digunakan.', category: 'UI/UX', createdAt: '2025-11-04', cover: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85' },
    { id: 'album-image', name: 'Cerita dalam Gambar', description: 'Catatan visual, fotografi, dan eksperimen kecil dari keseharian.', category: 'Fotografi', createdAt: '2025-08-20', cover: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1000&q=85' }
  ],
  works: [
    { id: 'work-brand', albumId: 'album-brand', title: 'Warna, bentuk, karakter', description: 'Eksplorasi identitas visual melalui material cetak, warna hangat, dan bentuk sederhana.', category: 'Branding', year: 2026, tools: 'Adobe Illustrator, Photoshop', image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1400&q=85', featured: true },
    { id: 'work-digital', albumId: 'album-digital', title: 'Ruang untuk ide baru', description: 'Studi arah desain untuk ruang kerja kreatif yang mengutamakan fokus dan kolaborasi.', category: 'UI/UX', year: 2025, tools: 'Figma', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=85', featured: true },
    { id: 'work-story', albumId: 'album-image', title: 'Ruang untuk bertemu', description: 'Kumpulan catatan visual yang membawa orang bertemu melalui cerita dan suasana.', category: 'Fotografi', year: 2025, tools: 'Lightroom, Kamera', image: 'https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&w=1400&q=85', featured: true }
  ]
};

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);
let portfolio = loadData();
let currentCategory = 'all';
let currentAlbumId = null;
let detailWorkIds = [];
let favoriteIds = new Set(readFavorites());
let authSession = null;
let accountDataReady = false;
let accountMode = 'signup';
let cloudSaveTimer = null;
let cloudSaveQueue = Promise.resolve();
let publicProfiles = [];
let followingIds = new Set();
let followingProfiles = [];
let followerProfiles = [];
let followingCount = 0;
let followersCount = 0;
let notifications = [];
let selectedSocialView = 'creators';
let notificationChannel = null;

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.albums) && Array.isArray(saved.works)) return saved;
  } catch (error) {
    console.warn('Portfolio data could not be read; showing starter content.', error);
  }
  return JSON.parse(JSON.stringify(STARTER_DATA));
}

function createEmptyPortfolio() {
  return { albums: [], works: [], profile: { name: '', picture: '', bio: '', interests: [] } };
}

function saveLocalData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
    return true;
  } catch (error) {
    alert('Penyimpanan browser penuh. Coba gambar yang lebih kecil atau hapus beberapa karya.');
    console.error('Portfolio data could not be saved.', error);
    return false;
  }
}

function saveData() {
  if (!canManagePortfolio()) return false;
  if (!saveLocalData()) return false;
  scheduleCloudSave();
  return true;
}

function canManagePortfolio() {
  return Boolean(authSession?.user && accountDataReady);
}

function requirePortfolioOwner() {
  if (canManagePortfolio()) return true;
  if (!authSession?.user) location.href = 'login.html';
  return false;
}

function renderPermissions() {
  const canManage = canManagePortfolio();
  document.querySelectorAll('[data-owner-only]').forEach((control) => {
    control.hidden = !canManage;
  });
  byId('open-account').title = authSession?.user ? authSession.user.email : 'Masuk untuk mengelola portfolio';
}

function setCreatorStatus(message, isError = false) {
  const status = byId('creator-status');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function renderCreators() {
  const query = byId('creator-search').value.trim().toLocaleLowerCase('id');
  const profiles = publicProfiles.filter((profile) => profile.user_id !== authSession?.user?.id
    && profile.display_name.toLocaleLowerCase('id').includes(query));
  byId('creator-grid').innerHTML = profiles.map((profile) => {
    const following = followingIds.has(profile.user_id);
    const avatar = profile.picture_url
      ? `<img src="${safeText(profile.picture_url)}" alt="" loading="lazy">`
      : safeText(profile.display_name.trim().charAt(0).toLocaleUpperCase('id'));
    const interests = Array.isArray(profile.interests) ? profile.interests.slice(0, 4) : [];
    const action = authSession?.user
      ? `<button class="follow-button${following ? ' is-following' : ''}" type="button" data-follow-user="${safeText(profile.user_id)}" aria-pressed="${following}">${following ? 'Diikuti' : '+ Ikuti'}</button>`
      : '<a class="follow-button" href="login.html#creators">Masuk untuk ikuti</a>';
    const profileLink = `creator.html?id=${encodeURIComponent(profile.user_id)}`;
    return `<article class="creator-card"><div class="creator-avatar">${avatar}</div><div class="creator-copy"><h3>${safeText(profile.display_name)}</h3><p>${safeText(profile.bio || 'Belum menambahkan bio.')}</p>${interests.length ? `<div class="creator-interests">${interests.map((interest) => `<span>${safeText(interest)}</span>`).join('')}</div>` : ''}<a class="creator-view-link" href="${profileLink}">Lihat portfolio ↗</a></div>${action}</article>`;
  }).join('');

  if (!profiles.length) {
    byId('creator-grid').innerHTML = `<p class="creator-empty">${publicProfiles.length ? 'Tidak ada kreator yang cocok dengan pencarian.' : 'Belum ada kreator yang membuat profil publik.'}</p>`;
  }
}

function renderConnections(profiles) {
  byId('following-count').textContent = String(followingCount);
  byId('followers-count').textContent = String(followersCount);
  document.querySelectorAll('[data-social-tab]').forEach((tab) => {
    const selected = tab.dataset.socialTab === selectedSocialView;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-pressed', String(selected));
  });

  const list = selectedSocialView === 'following' ? followingProfiles : followerProfiles;
  const showList = selectedSocialView !== 'creators';
  byId('creator-grid').hidden = showList;
  byId('social-list-heading').hidden = !showList;
  byId('social-list').hidden = !showList;
  if (!showList) return;

  byId('social-list-heading').textContent = selectedSocialView === 'following' ? 'Akun yang kamu ikuti' : 'Pengikutmu';
  byId('social-list').innerHTML = list.length ? list.map((profile) => {
    const following = followingIds.has(profile.user_id);
    const avatar = profile.picture_url
      ? `<img src="${safeText(profile.picture_url)}" alt="" loading="lazy">`
      : safeText(profile.display_name.trim().charAt(0).toLocaleUpperCase('id'));
    const interests = Array.isArray(profile.interests) ? profile.interests.slice(0, 4) : [];
    const action = selectedSocialView === 'followers'
      ? `<button class="follow-button${following ? ' is-following' : ''}" type="button" data-follow-user="${safeText(profile.user_id)}" aria-pressed="${following}">${following ? 'Diikuti' : 'Ikuti balik'}</button>`
      : `<button class="follow-button is-following" type="button" data-follow-user="${safeText(profile.user_id)}" aria-pressed="true">Mengikuti</button>`;
    const profileLink = `creator.html?id=${encodeURIComponent(profile.user_id)}`;
    return `<article class="creator-card"><div class="creator-avatar">${avatar}</div><div class="creator-copy"><h3>${safeText(profile.display_name)}</h3><p>${safeText(profile.bio || 'Belum menambahkan bio.')}</p>${interests.length ? `<div class="creator-interests">${interests.map((interest) => `<span>${safeText(interest)}</span>`).join('')}</div>` : ''}<a class="creator-view-link" href="${profileLink}">Lihat portfolio ↗</a></div>${action}</article>`;
  }).join('') : `<p class="creator-empty">${selectedSocialView === 'following' ? 'Kamu belum mengikuti kreator lain.' : 'Belum ada yang mengikuti akunmu.'}</p>`;
}

function renderNotifications() {
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  byId('notification-count').textContent = String(unreadCount);
  byId('notification-count').setAttribute('aria-label', `${unreadCount} belum dibaca`);
  byId('notification-list').innerHTML = notifications.length ? notifications.map((notification) => {
    const actor = publicProfiles.find((profile) => profile.user_id === notification.actor_id);
    const actorName = actor?.display_name || 'Seseorang';
    const avatar = actor?.picture_url
      ? `<img src="${safeText(actor.picture_url)}" alt="" loading="lazy">`
      : safeText(actorName.trim().charAt(0).toLocaleUpperCase('id'));
    const date = new Date(notification.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `<article class="notification-item${notification.read_at ? '' : ' is-unread'}"><div class="creator-avatar">${avatar}</div><div class="notification-copy"><strong>${safeText(actorName)} mulai mengikuti akunmu</strong><span>Aktivitas kreator di myprtflioo</span></div><time datetime="${safeText(notification.created_at)}">${safeText(date)}</time></article>`;
  }).join('') : '<p class="notification-empty">Belum ada notifikasi.</p>';
}

function subscribeToNotifications(userId) {
  if (!supabaseClient || !userId) return;
  if (notificationChannel) supabaseClient.removeChannel(notificationChannel);
  notificationChannel = supabaseClient
    .channel(`account-notifications-${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: NOTIFICATION_TABLE,
      filter: `recipient_id=eq.${userId}`
    }, (event) => {
      notifications = [event.new, ...notifications.filter((item) => item.id !== event.new.id)].slice(0, 30);
      renderNotifications();
      byId('notification-status').textContent = 'Ada pengikut baru.';
    })
    .subscribe();
}

async function loadNotifications(markAsRead = false) {
  if (!authSession?.user || !supabaseClient) return;
  const { data, error } = await supabaseClient.from(NOTIFICATION_TABLE)
    .select('id, actor_id, created_at, read_at')
    .eq('recipient_id', authSession.user.id)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    byId('notification-status').textContent = `Notifikasi belum tersedia: ${error.message}. Jalankan pembaruan social-schema.sql.`;
    return;
  }

  notifications = data || [];
  renderNotifications();
  if (markAsRead) {
    const unreadIds = notifications.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (unreadIds.length) {
      const readAt = new Date().toISOString();
      const { error: updateError } = await supabaseClient.from(NOTIFICATION_TABLE)
        .update({ read_at: readAt })
        .in('id', unreadIds);
      if (updateError) byId('notification-status').textContent = `Notifikasi tidak dapat ditandai dibaca: ${updateError.message}`;
      else notifications = notifications.map((notification) => unreadIds.includes(notification.id) ? { ...notification, read_at: readAt } : notification);
    }
  }
  renderNotifications();
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  byId('notification-status').textContent = unreadCount ? `${unreadCount} notifikasi belum dibaca.` : 'Semua notifikasi sudah dibaca.';
}

async function openNotifications() {
  if (!authSession?.user) { location.href = 'login.html#creators'; return; }
  byId('notifications-dialog').showModal();
  await loadNotifications(true);
}

async function loadCreators() {
  byId('social-tools').hidden = !authSession?.user;
  selectedSocialView = document.querySelector('[data-social-tab].is-active')?.dataset.socialTab || 'creators';
  if (!supabaseClient) {
    publicProfiles = [];
    followingProfiles = [];
    followerProfiles = [];
    followingCount = 0;
    followersCount = 0;
    followingIds.clear();
    renderConnections([]);
    renderCreators();
    setCreatorStatus('Direktori kreator akan tersedia setelah Supabase dikonfigurasi.');
    return;
  }

  setCreatorStatus('Memuat kreator…');
  const { data: profiles, error: profileError } = await supabaseClient
    .from(PROFILE_TABLE)
    .select('user_id, display_name, picture_url, bio, interests')
    .order('display_name', { ascending: true });
  if (profileError) {
    publicProfiles = [];
    followingIds.clear();
    renderCreators();
    setCreatorStatus(`Direktori belum siap: ${profileError.message}. Jalankan social-schema.sql di Supabase.`, true);
    return;
  }

  publicProfiles = (profiles || []).filter((profile) => profile.display_name);
  if (authSession?.user) {
    const { data: relations, error: followsError } = await supabaseClient
      .from(FOLLOW_TABLE)
      .select('follower_id, following_id');
    if (followsError) {
      followingIds.clear();
      followingProfiles = [];
      followerProfiles = [];
      followingCount = 0;
      followersCount = 0;
      setCreatorStatus(`Status follow tidak dapat dimuat: ${followsError.message}`, true);
    } else {
      const ownFollowing = (relations || []).filter((relation) => relation.follower_id === authSession.user.id);
      const ownFollowers = (relations || []).filter((relation) => relation.following_id === authSession.user.id);
      const profileById = new Map(publicProfiles.map((profile) => [profile.user_id, profile]));
      const unavailableProfile = { display_name: 'Profil kreator tidak tersedia', picture_url: null, bio: '', interests: [] };
      followingIds = new Set(ownFollowing.map((relation) => relation.following_id));
      followingCount = ownFollowing.length;
      followersCount = ownFollowers.length;
      followingProfiles = ownFollowing.map((relation) => ({ ...unavailableProfile, ...profileById.get(relation.following_id), user_id: relation.following_id }));
      followerProfiles = ownFollowers.map((relation) => ({ ...unavailableProfile, ...profileById.get(relation.follower_id), user_id: relation.follower_id }));
    }
    await loadNotifications();
  } else {
    selectedSocialView = 'creators';
    followingIds.clear();
    followingProfiles = [];
    followerProfiles = [];
    followingCount = 0;
    followersCount = 0;
    notifications = [];
  }

  renderConnections(publicProfiles);
  renderCreators();
  setCreatorStatus(`${publicProfiles.filter((profile) => profile.user_id !== authSession?.user?.id).length} kreator tersedia.`);
}

async function syncPublicProfile(userId, profile) {
  if (!supabaseClient || !userId) return;
  if (!profile.name.trim()) {
    const { error } = await supabaseClient.from(PROFILE_TABLE).delete().eq('user_id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.from(PROFILE_TABLE).upsert({
      user_id: userId,
      display_name: profile.name.trim(),
      picture_url: profile.picture || null,
      bio: profile.bio || '',
      interests: profile.interests || [],
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  }
  await loadCreators();
}

async function toggleFollow(button) {
  if (!authSession?.user) {
    location.href = 'login.html#creators';
    return;
  }

  const followingId = button.dataset.followUser;
  if (!followingId || followingId === authSession.user.id) return;
  const wasFollowing = followingIds.has(followingId);
  button.disabled = true;
  try {
    const result = wasFollowing
      ? await supabaseClient.from(FOLLOW_TABLE).delete().eq('follower_id', authSession.user.id).eq('following_id', followingId)
      : await supabaseClient.from(FOLLOW_TABLE).insert({ follower_id: authSession.user.id, following_id: followingId });
    if (result.error) throw result.error;
    await loadCreators();
  } catch (error) {
    setCreatorStatus(`Perubahan follow gagal: ${error.message}`, true);
    button.disabled = false;
  }
}

function setAccountStatus(message, isError = false) {
  const status = byId('account-status');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function renderAccountState() {
  const hasAccount = Boolean(authSession?.user);
  const configured = Boolean(supabaseClient);
  byId('account-nav-label').textContent = 'Akun';
  byId('open-account').title = hasAccount ? authSession.user.email : 'Masuk untuk mengelola portfolio';
  byId('account-credentials').hidden = !configured || hasAccount;
  byId('account-signout').hidden = !configured || !hasAccount;
  byId('account-mode-toggle').hidden = !configured || hasAccount;
  byId('account-form-heading').textContent = accountMode === 'signup' ? 'Buat akun' : 'Masuk';
  byId('account-submit').textContent = accountMode === 'signup' ? 'Buat akun' : 'Masuk';
  byId('account-mode-toggle').textContent = accountMode === 'signup' ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Buat akun';
  if (!configured) {
    setAccountStatus('Fitur akun belum dikonfigurasi. Isi URL proyek dan anon key Supabase pada supabase-config.js, lalu siapkan tabel sesuai petunjuk README.');
  } else if (hasAccount) {
    setAccountStatus(`Masuk sebagai ${authSession.user.email}. Portfolio disinkronkan ke akun ini.`);
  }
}

function persistCloudSnapshot(snapshot, userId) {
  cloudSaveQueue = cloudSaveQueue.catch(() => {}).then(async () => {
    const { error } = await supabaseClient.from(CLOUD_TABLE).upsert({
      user_id: userId,
      data: snapshot,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  });
  return cloudSaveQueue;
}

async function syncAccountData(userId) {
  if (!supabaseClient || !userId) return;
  const snapshot = JSON.parse(JSON.stringify(portfolio));
  setAccountStatus('Menyinkronkan portfolio…');
  try {
    await persistCloudSnapshot(snapshot, userId);
    if (authSession?.user?.id === userId) setAccountStatus('Portfolio tersimpan di browser dan akun.');
  } catch (error) {
    if (authSession?.user?.id === userId) setAccountStatus(`Gagal menyinkronkan: ${error.message}`, true);
  }
}

function scheduleCloudSave() {
  if (!authSession?.user || !supabaseClient) return;
  clearTimeout(cloudSaveTimer);
  const userId = authSession.user.id;
  cloudSaveTimer = setTimeout(() => syncAccountData(userId), 600);
}

async function loadAccountData(userId) {
  setAccountStatus('Memuat portfolio akun…');
  const { data: row, error } = await supabaseClient.from(CLOUD_TABLE).select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;

  if (row) {
    if (!row.data || !Array.isArray(row.data.albums) || !Array.isArray(row.data.works)) {
      throw new Error('Data portfolio di akun tidak memiliki format yang dikenal.');
    }
    const savedProfile = row.data.profile || {};
    portfolio = {
      ...row.data,
      profile: {
        name: savedProfile.name || '',
        picture: savedProfile.picture || '',
        bio: savedProfile.bio || '',
        interests: Array.isArray(savedProfile.interests) ? savedProfile.interests : []
      }
    };
  } else {
    portfolio = createEmptyPortfolio();
    favoriteIds.clear();
    saveFavorites();
    if (!saveLocalData()) throw new Error('Portfolio tidak dapat disimpan di browser ini.');
    await persistCloudSnapshot(JSON.parse(JSON.stringify(portfolio)), userId);
  }

  accountDataReady = true;
  subscribeToNotifications(userId);
  if (!saveLocalData()) throw new Error('Portfolio akun berhasil dimuat, tetapi tidak dapat disimpan di browser ini.');
  renderAll();
  setAccountStatus('Portfolio tersimpan di browser dan akun.');
  try {
    await syncPublicProfile(userId, portfolio.profile);
  } catch (profileError) {
    setCreatorStatus(`Profil publik belum tersinkron: ${profileError.message}. Periksa social-schema.sql.`, true);
  }
}

async function initializeAccount() {
  accountDataReady = false;
  renderPermissions();
  renderAccountState();
  if (!supabaseClient) { await loadCreators(); return; }
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    setAccountStatus(`Sesi akun tidak dapat dibaca: ${error.message}`, true);
    return;
  }
  authSession = data.session;
  renderAccountState();
  if (authSession) {
    try { await loadAccountData(authSession.user.id); }
    catch (loadError) { accountDataReady = false; renderPermissions(); setAccountStatus(`Portfolio cloud belum dapat dimuat: ${loadError.message}`, true); }
  } else await loadCreators();
}

async function submitAccountForm(event) {
  event.preventDefault();
  if (!supabaseClient) return;
  const form = event.currentTarget;
  const submit = byId('account-submit');
  submit.disabled = true;
  setAccountStatus(accountMode === 'signup' ? 'Membuat akun…' : 'Memeriksa akun…');
  try {
    const credentials = { email: form.elements.email.value.trim(), password: form.elements.password.value };
    const { data, error } = accountMode === 'signup'
      ? await supabaseClient.auth.signUp(credentials)
      : await supabaseClient.auth.signInWithPassword(credentials);
    if (error) throw error;
    if (!data.session) {
      accountMode = 'login';
      renderAccountState();
      setAccountStatus('Akun dibuat. Periksa email untuk konfirmasi, lalu masuk.');
      form.reset();
      return;
    }
    authSession = data.session;
    renderAccountState();
    await loadAccountData(authSession.user.id);
    renderPermissions();
  } catch (error) {
    setAccountStatus(error.message || 'Akun tidak dapat diproses.', true);
  } finally {
    submit.disabled = false;
  }
}

async function signOutAccount() {
  if (!supabaseClient || !authSession) return;
  clearTimeout(cloudSaveTimer);
  const userId = authSession.user.id;
  await syncAccountData(userId);
  if (notificationChannel) {
    await supabaseClient.removeChannel(notificationChannel);
    notificationChannel = null;
  }
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    setAccountStatus(`Tidak dapat keluar: ${error.message}`, true);
    return;
  }
  authSession = null;
  accountDataReady = false;
  accountMode = 'login';
  byId('account-form').reset();
  renderAccountState();
  renderAll();
  renderPermissions();
  await loadCreators();
  setAccountStatus('Anda sudah keluar. Data browser tetap tersedia di perangkat ini.');
}

function readFavorites() {
  try { return JSON.parse(localStorage.getItem('fira-gallery-favorites') || '[]'); }
  catch { return []; }
}

function safeText(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function albumFor(id) {
  return portfolio.albums.find((album) => album.id === id);
}

function renderFilters() {
  const categories = [...new Set(portfolio.works.map((work) => work.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
  if (!categories.includes(currentCategory)) currentCategory = 'all';
  byId('category-filters').innerHTML = ['all', ...categories].map((category) => {
    const label = category === 'all' ? 'Semua' : category;
    const selected = currentCategory === category;
    return `<button class="filter-chip${selected ? ' is-active' : ''}" type="button" data-category="${safeText(category)}" aria-pressed="${selected}">${safeText(label)}</button>`;
  }).join('');
}

function getVisibleWorks() {
  const query = byId('work-search').value.trim().toLocaleLowerCase('id');
  const sort = byId('work-sort').value;
  const works = portfolio.works.filter((work) => {
    const album = albumFor(work.albumId);
    const matchesCategory = currentCategory === 'all' || work.category === currentCategory;
    const matchesAlbum = !currentAlbumId || work.albumId === currentAlbumId;
    const searchableText = [work.title, work.description, work.category, work.year, album?.name].join(' ').toLocaleLowerCase('id');
    return matchesCategory && matchesAlbum && searchableText.includes(query);
  });
  works.sort((a, b) => {
    if (sort === 'oldest') return a.year - b.year;
    if (sort === 'title') return a.title.localeCompare(b.title, 'id');
    if (sort === 'album') {
      const albumOrder = (albumFor(a.albumId)?.name || '').localeCompare(albumFor(b.albumId)?.name || '', 'id');
      return albumOrder || a.title.localeCompare(b.title, 'id');
    }
    return b.year - a.year;
  });
  return works;
}

function renderWorks() {
  renderFilters();
  const selectedAlbum = albumFor(currentAlbumId);
  const crumb = byId('album-crumb');
  crumb.hidden = !selectedAlbum;
  crumb.innerHTML = selectedAlbum ? `<span>Albums / <strong>${safeText(selectedAlbum.name)}</strong></span><div>${canManagePortfolio() ? `<button type="button" data-add-to-album="${safeText(selectedAlbum.id)}">+ Tambah karya</button>` : ''}<button type="button" data-clear-album>Semua karya ×</button></div>` : '';

  const works = getVisibleWorks();
  byId('visible-count').textContent = String(works.length).padStart(2, '0');
  byId('work-empty').hidden = works.length > 0;
  byId('work-grid').innerHTML = works.map((work, index) => {
    const album = albumFor(work.albumId);
    const liked = favoriteIds.has(work.id);
    return `<article class="work-card">
      <button class="work-image" type="button" data-open-work="${safeText(work.id)}" aria-label="Lihat ${safeText(work.title)}">
        <img src="${safeText(work.image)}" alt="${safeText(work.title)}" loading="lazy">
        <span class="image-label">${String(index + 1).padStart(2, '0')} / ${safeText(work.year)}</span><span class="image-open" aria-hidden="true">↗</span>
        ${work.featured ? '<span class="featured-label">PILIHAN</span>' : ''}
      </button>
      <div class="work-caption"><div><p>${safeText(work.category)}${album ? ` · ${safeText(album.name)}` : ''}</p><h3>${safeText(work.title)}</h3></div>${canManagePortfolio() ? `<button class="favorite-button${liked ? ' is-favorite' : ''}" type="button" data-favorite="${safeText(work.id)}" aria-label="${liked ? 'Hapus dari' : 'Tambah ke'} favorit">${liked ? '♥' : '♡'}</button>` : ''}</div>
    </article>`;
  }).join('');
}

function renderAlbums() {
  byId('album-empty').hidden = portfolio.albums.length > 0;
  byId('album-grid').innerHTML = portfolio.albums.map((album) => {
    const works = portfolio.works.filter((work) => work.albumId === album.id);
    const cover = album.cover || works[0]?.image || '';
    const date = new Date(`${album.createdAt}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    return `<article class="album-card">
      <button class="album-cover" type="button" data-open-album="${safeText(album.id)}" aria-label="Lihat album ${safeText(album.name)}"><img src="${safeText(cover)}" alt="Cover album ${safeText(album.name)}" loading="lazy"><span>${String(works.length).padStart(2, '0')} KARYA</span></button>
      <div class="album-description"><p class="eyebrow">${safeText(album.category)} · ${safeText(date)}</p><h3>${safeText(album.name)}</h3><p>${safeText(album.description || '')}</p></div>
      <div class="album-actions"><button type="button" data-open-album="${safeText(album.id)}">Lihat album ↗</button>${canManagePortfolio() ? `<button type="button" data-add-to-album="${safeText(album.id)}">+ Karya</button>` : ''}</div>
    </article>`;
  }).join('');
}

function renderDashboard() {
  const categories = new Set(portfolio.works.map((work) => work.category).filter(Boolean));
  byId('dashboard-stats').innerHTML = `<div><strong>${portfolio.albums.length}</strong><span>Album</span></div><div><strong>${portfolio.works.length}</strong><span>Karya</span></div><div><strong>${categories.size}</strong><span>Kategori</span></div>`;
  const albumRows = portfolio.albums.map((album) => `<div class="manage-row"><div><strong>${safeText(album.name)}</strong><span>${portfolio.works.filter((work) => work.albumId === album.id).length} karya · ${safeText(album.category)}</span></div><button type="button" data-open-album="${safeText(album.id)}">Lihat</button><button type="button" data-edit-album="${safeText(album.id)}" data-owner-only>Edit</button><button class="danger-button" type="button" data-delete-album="${safeText(album.id)}" data-owner-only>Hapus</button></div>`).join('');
  const recentWorks = [...portfolio.works].sort((a, b) => b.year - a.year).slice(0, 8);
  const workRows = recentWorks.map((work) => `<div class="manage-row"><div><strong>${safeText(work.title)}</strong><span>${safeText(albumFor(work.albumId)?.name || 'Tanpa album')} · ${safeText(work.year)}</span></div><button type="button" data-open-work="${safeText(work.id)}">Lihat</button><button type="button" data-edit-work="${safeText(work.id)}" data-owner-only>Edit</button><button class="danger-button" type="button" data-delete-work="${safeText(work.id)}" data-owner-only>Hapus</button></div>`).join('');
  byId('manage-list').innerHTML = `<h3>Kelola album</h3>${albumRows || '<p class="empty-state">Belum ada album.</p>'}<h3>Karya terbaru</h3>${workRows || '<p class="empty-state">Belum ada karya.</p>'}`;
}

function renderAll() {
  byId('hero-work-count').textContent = String(portfolio.works.length).padStart(2, '0');
  byId('hero-album-count').textContent = String(portfolio.albums.length).padStart(2, '0');
  renderWorks();
  renderAlbums();
  renderProfile();
  renderDashboard();
  renderPermissions();
}

function renderProfile() {
  const hasCustomProfile = Boolean(authSession?.user || portfolio.profile);
  const profile = hasCustomProfile ? portfolio.profile || createEmptyPortfolio().profile : PUBLIC_PROFILE;
  const picture = byId('profile-picture');
  const name = profile.name || '';
  const bio = profile.bio || '';
  const interests = Array.isArray(profile.interests) ? profile.interests : [];

  if (profile.picture) picture.src = profile.picture;
  else picture.removeAttribute('src');
  picture.alt = name ? `Foto profil ${name}` : 'Foto profil';
  picture.hidden = hasCustomProfile && !profile.picture;
  byId('profile-name').textContent = name;
  byId('profile-role').hidden = hasCustomProfile;
  byId('profile-school').hidden = hasCustomProfile;
  byId('profile-row').hidden = hasCustomProfile && !name && !profile.picture;
  byId('profile-bio').textContent = bio;
  byId('profile-interests').innerHTML = interests.map((interest) => `<span>${safeText(interest)}</span>`).join('');
  byId('about-details').hidden = hasCustomProfile && !bio && interests.length === 0;
  byId('profile-social-links').hidden = hasCustomProfile;
  byId('profile-initial').textContent = name.trim().charAt(0) || '';
}

function openAlbumForm(album = null) {
  if (!requirePortfolioOwner()) return;
  const form = byId('album-form');
  form.reset();
  form.elements.id.value = album?.id || '';
  form.elements.name.value = album?.name || '';
  form.elements.description.value = album?.description || '';
  form.elements.category.value = album?.category || '';
  byId('album-form-heading').textContent = album ? 'Edit album' : 'Album baru';
  byId('album-dialog').showModal();
}

function openWorkForm(work = null, albumId = '') {
  if (!requirePortfolioOwner()) return;
  if (!portfolio.albums.length) {
    alert('Buat album terlebih dahulu sebelum menambahkan karya.');
    openAlbumForm();
    return;
  }
  const form = byId('work-form');
  form.reset();
  form.elements.albumId.innerHTML = portfolio.albums.map((album) => `<option value="${safeText(album.id)}">${safeText(album.name)}</option>`).join('');
  form.elements.id.value = work?.id || '';
  form.elements.albumId.value = work?.albumId || albumId || portfolio.albums[0].id;
  form.elements.title.value = work?.title || '';
  form.elements.description.value = work?.description || '';
  form.elements.category.value = work?.category || '';
  form.elements.year.value = work?.year || new Date().getFullYear();
  form.elements.tools.value = work?.tools || '';
  form.elements.projectUrl.value = work?.projectUrl || '';
  form.elements.socialUrl.value = work?.socialUrl || '';
  form.elements.featured.checked = Boolean(work?.featured);
  byId('work-form-heading').textContent = work ? 'Edit karya' : 'Karya baru';
  byId('work-dialog').showModal();
}

function openProfileForm() {
  if (!requirePortfolioOwner()) return;
  const form = byId('profile-form');
  const profile = portfolio.profile || createEmptyPortfolio().profile;
  form.reset();
  form.elements.name.value = profile.name;
  form.elements.bio.value = profile.bio;
  form.elements.interests.value = profile.interests.join('\n');
  byId('remove-profile-picture-row').hidden = !profile.picture;
  byId('profile-dialog').showModal();
}

async function storeProfile(event) {
  event.preventDefault();
  if (!requirePortfolioOwner()) return;
  const form = event.currentTarget;
  const currentProfile = portfolio.profile || createEmptyPortfolio().profile;
  try {
    const uploadedPicture = await compressImage(form.elements.pictureFile.files[0], 600, 0.78);
    portfolio.profile = {
      name: form.elements.name.value.trim(),
      picture: uploadedPicture || (form.elements.removePicture.checked ? '' : currentProfile.picture),
      bio: form.elements.bio.value.trim(),
      interests: form.elements.interests.value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 15)
    };
    if (saveData()) {
      renderAll();
      byId('profile-dialog').close();
      try { await syncPublicProfile(authSession.user.id, portfolio.profile); }
      catch (error) { setCreatorStatus(`Profil tersimpan, tetapi gagal ditampilkan di direktori: ${error.message}`, true); }
    }
  } catch (error) { alert(error.message); }
}

function compressImage(file, maxDimension = 1400, quality = 0.8) {
  if (!file) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File gambar tidak dapat dibaca.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('File yang dipilih bukan gambar yang valid.'));
      image.onload = () => {
        const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.naturalWidth * ratio);
        canvas.height = Math.round(image.naturalHeight * ratio);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openWorkDetail(workId, direction = 0) {
  let index = detailWorkIds.indexOf(workId);
  if (index < 0) {
    detailWorkIds = getVisibleWorks().map((work) => work.id);
    index = detailWorkIds.indexOf(workId);
  }
  if (index >= 0) index = (index + direction + detailWorkIds.length) % detailWorkIds.length;
  const work = portfolio.works.find((item) => item.id === detailWorkIds[index]) || portfolio.works.find((item) => item.id === workId);
  if (!work) return;
  const album = albumFor(work.albumId);
  const link = (url, label) => url ? `<a href="${safeText(url)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>` : '';
  byId('detail-content').innerHTML = `<button class="close-button detail-close" type="button" data-close aria-label="Tutup">×</button><div class="detail-image"><img src="${safeText(work.image)}" alt="${safeText(work.title)}"></div><div class="detail-copy"><p class="eyebrow">${safeText(work.category)} · ${safeText(work.year)}</p><h2>${safeText(work.title)}</h2><p>${safeText(work.description || '')}</p><dl><div><dt>Album</dt><dd>${safeText(album?.name || '—')}</dd></div><div><dt>Tahun</dt><dd>${safeText(work.year)}</dd></div><div><dt>Tools</dt><dd>${safeText(work.tools || '—')}</dd></div></dl><div class="detail-links">${link(work.projectUrl, 'Project')}${link(work.socialUrl, 'Link karya')}<button type="button" data-share-work="${safeText(work.id)}">Bagikan ↗</button><button type="button" data-copy-work="${safeText(work.id)}">Salin tautan</button><a href="${safeText(work.image)}" download="${safeText(work.title.replace(/[^a-z0-9-_]+/gi, '-'))}.jpg">Unduh gambar ↓</a></div><div class="detail-navigation"><button type="button" data-step-work="-1">← Sebelumnya</button><button type="button" data-step-work="1">Berikutnya →</button></div></div>`;
  byId('detail-dialog').showModal();
}

function showAlbum(albumId) {
  currentAlbumId = albumId;
  renderWorks();
  byId('portfolio').scrollIntoView({ behavior: 'smooth' });
}

async function storeAlbum(event) {
  event.preventDefault();
  if (!requirePortfolioOwner()) return;
  const form = event.currentTarget;
  const oldAlbum = albumFor(form.elements.id.value);
  try {
    const uploadedCover = await compressImage(form.elements.coverFile.files[0]);
    const album = {
      id: oldAlbum?.id || `album-${crypto.randomUUID()}`,
      name: form.elements.name.value.trim(),
      description: form.elements.description.value.trim(),
      category: form.elements.category.value.trim(),
      createdAt: oldAlbum?.createdAt || new Date().toISOString().slice(0, 10),
      cover: uploadedCover || oldAlbum?.cover || ''
    };
    portfolio.albums = oldAlbum ? portfolio.albums.map((item) => item.id === oldAlbum.id ? album : item) : [album, ...portfolio.albums];
    if (saveData()) { renderAll(); byId('album-dialog').close(); }
  } catch (error) { alert(error.message); }
}

async function storeWork(event) {
  event.preventDefault();
  if (!requirePortfolioOwner()) return;
  const form = event.currentTarget;
  const oldWork = portfolio.works.find((work) => work.id === form.elements.id.value);
  try {
    const uploadedImage = await compressImage(form.elements.imageFile.files[0]);
    if (!uploadedImage && !oldWork?.image) { alert('Pilih gambar untuk karya ini.'); return; }
    const work = {
      id: oldWork?.id || `work-${crypto.randomUUID()}`,
      albumId: form.elements.albumId.value,
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      category: form.elements.category.value.trim(),
      year: Number(form.elements.year.value),
      tools: form.elements.tools.value.trim(),
      projectUrl: form.elements.projectUrl.value.trim(),
      socialUrl: form.elements.socialUrl.value.trim(),
      image: uploadedImage || oldWork.image,
      featured: form.elements.featured.checked
    };
    portfolio.works = oldWork ? portfolio.works.map((item) => item.id === oldWork.id ? work : item) : [work, ...portfolio.works];
    const album = albumFor(work.albumId);
    if (album && !album.cover) album.cover = work.image;
    if (saveData()) { renderAll(); byId('work-dialog').close(); }
  } catch (error) { alert(error.message); }
}

function saveFavorites() {
  localStorage.setItem('fira-gallery-favorites', JSON.stringify([...favoriteIds]));
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-close')) button.closest('dialog').close();
  if (button.dataset.action === 'add-album') openAlbumForm();
  if (button.dataset.action === 'add-work') openWorkForm();
  if (button.dataset.action === 'edit-profile') openProfileForm();
  if (button.dataset.followUser) await toggleFollow(button);
  if (button.dataset.socialTab) {
    selectedSocialView = button.dataset.socialTab;
    renderConnections(publicProfiles);
  }
  if (button.id === 'open-notifications') await openNotifications();
  if (button.id === 'open-dashboard' && requirePortfolioOwner()) { renderDashboard(); byId('dashboard-dialog').showModal(); }
  if (button.dataset.category !== undefined) { currentCategory = button.dataset.category; renderWorks(); }
  if (button.dataset.openAlbum) showAlbum(button.dataset.openAlbum);
  if (button.hasAttribute('data-clear-album')) { currentAlbumId = null; renderWorks(); }
  if (button.dataset.addToAlbum) openWorkForm(null, button.dataset.addToAlbum);
  if (button.dataset.openWork) openWorkDetail(button.dataset.openWork);
  if (button.dataset.editAlbum && requirePortfolioOwner()) openAlbumForm(albumFor(button.dataset.editAlbum));
  if (button.dataset.editWork && requirePortfolioOwner()) openWorkForm(portfolio.works.find((work) => work.id === button.dataset.editWork));
  if (button.dataset.deleteAlbum) {
    if (!requirePortfolioOwner()) return;
    const album = albumFor(button.dataset.deleteAlbum);
    if (album && confirm(`Hapus album "${album.name}" beserta semua karya di dalamnya?`)) {
      portfolio.albums = portfolio.albums.filter((item) => item.id !== album.id);
      portfolio.works = portfolio.works.filter((work) => work.albumId !== album.id);
      if (currentAlbumId === album.id) currentAlbumId = null;
      saveData(); renderAll();
    }
  }
  if (button.dataset.deleteWork) {
    if (!requirePortfolioOwner()) return;
    const work = portfolio.works.find((item) => item.id === button.dataset.deleteWork);
    if (work && confirm(`Hapus karya "${work.title}"?`)) {
      portfolio.works = portfolio.works.filter((item) => item.id !== work.id);
      favoriteIds.delete(work.id); saveFavorites(); saveData(); renderAll();
    }
  }
  if (button.dataset.favorite) {
    if (!requirePortfolioOwner()) return;
    favoriteIds.has(button.dataset.favorite) ? favoriteIds.delete(button.dataset.favorite) : favoriteIds.add(button.dataset.favorite);
    saveFavorites(); renderWorks();
  }
  if (button.dataset.stepWork) {
    const currentId = detailWorkIds.find((id) => portfolio.works.find((work) => work.id === id)?.title === $('#detail-content .detail-copy h2')?.textContent);
    if (currentId) openWorkDetail(currentId, Number(button.dataset.stepWork));
  }
  if (button.dataset.copyWork || button.dataset.shareWork) {
    const work = portfolio.works.find((item) => item.id === (button.dataset.copyWork || button.dataset.shareWork));
    if (!work) return;
    const url = new URL(location.href);
    url.hash = `work-${work.id}`;
    if (button.dataset.shareWork && navigator.share) {
      try { await navigator.share({ title: work.title, text: work.description, url: url.href }); } catch { /* Share sheet dismissed. */ }
    } else {
      try {
        await navigator.clipboard.writeText(url.href);
        button.textContent = 'Tautan tersalin';
      } catch {
        prompt('Salin tautan karya ini:', url.href);
      }
    }
  }
});

byId('album-form').addEventListener('submit', storeAlbum);
byId('work-form').addEventListener('submit', storeWork);
byId('open-account').addEventListener('click', () => {
  if (!canManagePortfolio()) { location.href = 'login.html'; return; }
  renderAccountState();
  byId('account-dialog').showModal();
});
byId('account-form').addEventListener('submit', submitAccountForm);
byId('profile-form').addEventListener('submit', storeProfile);
byId('creator-search').addEventListener('input', renderCreators);
byId('account-mode-toggle').addEventListener('click', () => {
  accountMode = accountMode === 'signup' ? 'login' : 'signup';
  byId('account-form').reset();
  renderAccountState();
  setAccountStatus(accountMode === 'signup' ? 'Buat akun baru untuk menyimpan portfolio secara online.' : 'Masuk untuk membuka portfolio yang tersimpan di akun.');
});
byId('account-signout').addEventListener('click', signOutAccount);
byId('work-search').addEventListener('input', renderWorks);
byId('work-sort').addEventListener('change', renderWorks);

byId('theme-toggle').addEventListener('click', () => {
  const light = document.body.classList.toggle('light-theme');
  localStorage.setItem('fira-gallery-theme', light ? 'light' : 'navy');
  byId('theme-toggle').setAttribute('aria-label', light ? 'Aktifkan tema navy' : 'Aktifkan tema terang');
});
if (localStorage.getItem('fira-gallery-theme') === 'light') {
  document.body.classList.add('light-theme');
  byId('theme-toggle').setAttribute('aria-label', 'Aktifkan tema navy');
}

const menuToggle = byId('menu-toggle');
const siteNav = byId('site-nav');
menuToggle.addEventListener('click', () => {
  const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!expanded));
  menuToggle.setAttribute('aria-label', expanded ? 'Buka navigasi' : 'Tutup navigasi');
  siteNav.classList.toggle('is-open', !expanded);
});
siteNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  siteNav.classList.remove('is-open');
}));
document.querySelectorAll('.app-dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
}));

renderAll();
initializeAccount();