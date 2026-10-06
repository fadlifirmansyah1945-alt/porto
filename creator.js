const creatorConfig = window.PORTFOLIO_SUPABASE_CONFIG || {};
const creatorClient = window.supabase && creatorConfig.url && creatorConfig.anonKey
  ? window.supabase.createClient(creatorConfig.url, creatorConfig.anonKey)
  : null;
const creatorId = new URLSearchParams(location.search).get('id');
const creatorById = (id) => document.getElementById(id);
let viewedCreator = null;
let viewedPortfolio = { albums: [], works: [] };
let viewerSession = null;
let viewerFollowsCreator = false;

function creatorText(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function setCreatorPageStatus(message, isError = false) {
  const status = creatorById('creator-page-status');
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function renderCreatorWorks() {
  const albumId = creatorById('creator-album-filter').value;
  const works = [...viewedPortfolio.works]
    .filter((work) => albumId === 'all' || work.albumId === albumId)
    .sort((first, second) => second.year - first.year || first.title.localeCompare(second.title, 'id'));
  creatorById('creator-work-empty').hidden = works.length > 0;
  creatorById('creator-work-grid').innerHTML = works.map((work, index) => {
    const album = viewedPortfolio.albums.find((item) => item.id === work.albumId);
    return `<article class="work-card">
      <button class="work-image" type="button" data-open-public-work="${creatorText(work.id)}" aria-label="Lihat ${creatorText(work.title)}">
        <img src="${creatorText(work.image)}" alt="${creatorText(work.title)}" loading="lazy">
        <span class="image-label">${String(index + 1).padStart(2, '0')} / ${creatorText(work.year)}</span><span class="image-open" aria-hidden="true">↗</span>
        ${work.featured ? '<span class="featured-label">PILIHAN</span>' : ''}
      </button>
      <div class="work-caption"><div><p>${creatorText(work.category || '')}${album ? ` · ${creatorText(album.name)}` : ''}</p><h3>${creatorText(work.title)}</h3></div></div>
    </article>`;
  }).join('');
}

function renderFollowAction() {
  const actions = creatorById('creator-profile-actions');
  if (!viewerSession?.user) {
    actions.innerHTML = '<a class="follow-button" href="login.html">Masuk untuk mengikuti</a>';
    return;
  }
  if (viewerSession.user.id === creatorId) {
    actions.innerHTML = '<a class="creator-owner-link" href="index.html">Kelola portfolio ↗</a>';
    return;
  }
  actions.innerHTML = `<button class="follow-button${viewerFollowsCreator ? ' is-following' : ''}" id="creator-follow-button" type="button" aria-pressed="${viewerFollowsCreator}">${viewerFollowsCreator ? 'Diikuti' : '+ Ikuti'}</button>`;
}

function renderCreatorPage() {
  const profile = viewedCreator;
  const portfolio = viewedPortfolio;
  creatorById('creator-page-status').hidden = true;
  creatorById('creator-profile').hidden = false;
  creatorById('creator-portfolio').hidden = false;
  document.title = `${profile.display_name} — myprtflioo`;
  creatorById('creator-name').textContent = profile.display_name;
  creatorById('creator-bio').textContent = profile.bio || 'Belum menambahkan bio.';
  creatorById('creator-interests').innerHTML = (Array.isArray(profile.interests) ? profile.interests : [])
    .map((interest) => `<span>${creatorText(interest)}</span>`).join('');
  creatorById('creator-profile-avatar').innerHTML = profile.picture_url
    ? `<img src="${creatorText(profile.picture_url)}" alt="Foto profil ${creatorText(profile.display_name)}">`
    : creatorText(profile.display_name.trim().charAt(0).toLocaleUpperCase('id'));
  creatorById('creator-work-count').textContent = String(portfolio.works.length).padStart(2, '0');
  creatorById('creator-album-count').textContent = String(portfolio.albums.length).padStart(2, '0');
  creatorById('creator-album-filter').innerHTML = '<option value="all">Semua album</option>'
    + portfolio.albums.map((album) => `<option value="${creatorText(album.id)}">${creatorText(album.name)}</option>`).join('');
  renderFollowAction();
  renderCreatorWorks();
}

async function loadCreatorPage() {
  if (!creatorClient) {
    setCreatorPageStatus('Portfolio kreator belum dapat dimuat: konfigurasi Supabase belum tersedia.', true);
    return;
  }
  if (!creatorId) {
    setCreatorPageStatus('Profil kreator tidak ditemukan.', true);
    return;
  }

  try {
    const [{ data: profile, error: profileError }, { data: portfolioRow, error: portfolioError }, { data: sessionResult, error: sessionError }] = await Promise.all([
      creatorClient.from('public_profiles').select('user_id, display_name, picture_url, bio, interests').eq('user_id', creatorId).maybeSingle(),
      creatorClient.from('portfolio_data').select('data').eq('user_id', creatorId).maybeSingle(),
      creatorClient.auth.getSession()
    ]);
    if (profileError) throw profileError;
    if (portfolioError) throw portfolioError;
    if (sessionError) throw sessionError;
    if (!profile) {
      setCreatorPageStatus('Profil ini tidak tersedia atau belum dipublikasikan.', true);
      return;
    }

    const data = portfolioRow?.data || { albums: [], works: [] };
    if (!Array.isArray(data.albums) || !Array.isArray(data.works)) throw new Error('Portfolio kreator memiliki format data yang tidak dikenal.');
    viewedCreator = profile;
    viewedPortfolio = data;
    viewerSession = sessionResult.session;

    if (viewerSession?.user && viewerSession.user.id !== creatorId) {
      const { data: relation, error: relationError } = await creatorClient.from('account_follows')
        .select('following_id')
        .eq('follower_id', viewerSession.user.id)
        .eq('following_id', creatorId)
        .maybeSingle();
      if (relationError) throw relationError;
      viewerFollowsCreator = Boolean(relation);
    }

    renderCreatorPage();
  } catch (error) {
    setCreatorPageStatus(`Portfolio tidak dapat dimuat: ${error.message}. Pastikan social-schema.sql sudah dijalankan.`, true);
  }
}

async function toggleCreatorFollow(button) {
  if (!creatorClient || !viewerSession?.user || !creatorId || creatorId === viewerSession.user.id) return;
  button.disabled = true;
  const result = viewerFollowsCreator
    ? await creatorClient.from('account_follows').delete().eq('follower_id', viewerSession.user.id).eq('following_id', creatorId)
    : await creatorClient.from('account_follows').insert({ follower_id: viewerSession.user.id, following_id: creatorId });
  if (result.error) {
    button.disabled = false;
    setCreatorPageStatus(`Status follow tidak dapat diubah: ${result.error.message}`, true);
    return;
  }
  viewerFollowsCreator = !viewerFollowsCreator;
  renderFollowAction();
}

function openPublicWork(workId) {
  const work = viewedPortfolio.works.find((item) => item.id === workId);
  if (!work) return;
  const album = viewedPortfolio.albums.find((item) => item.id === work.albumId);
  creatorById('creator-work-detail').innerHTML = `<button class="close-button detail-close" type="button" data-close aria-label="Tutup">×</button><div class="detail-image"><img src="${creatorText(work.image)}" alt="${creatorText(work.title)}"></div><div class="detail-copy"><p class="eyebrow">${creatorText(work.category || '')} · ${creatorText(work.year)}</p><h2>${creatorText(work.title)}</h2><p>${creatorText(work.description || '')}</p><dl><div><dt>Album</dt><dd>${creatorText(album?.name || '—')}</dd></div><div><dt>Tools</dt><dd>${creatorText(work.tools || '—')}</dd></div></dl></div>`;
  creatorById('creator-work-dialog').showModal();
}

creatorById('creator-album-filter').addEventListener('change', renderCreatorWorks);
creatorById('creator-profile-actions').addEventListener('click', (event) => {
  if (event.target.closest('#creator-follow-button')) toggleCreatorFollow(event.target.closest('#creator-follow-button'));
});
creatorById('creator-work-grid').addEventListener('click', (event) => {
  const workButton = event.target.closest('[data-open-public-work]');
  if (workButton) openPublicWork(workButton.dataset.openPublicWork);
});
document.addEventListener('click', (event) => {
  const closeButton = event.target.closest('[data-close]');
  if (closeButton) closeButton.closest('dialog').close();
});
creatorById('creator-work-dialog').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

loadCreatorPage();