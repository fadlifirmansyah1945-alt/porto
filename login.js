const authConfig = window.PORTFOLIO_SUPABASE_CONFIG || {};
const authClient = window.supabase && authConfig.url && authConfig.anonKey
  ? window.supabase.createClient(authConfig.url, authConfig.anonKey)
  : null;
const authForm = document.getElementById('auth-form');
const authStatus = document.getElementById('auth-status');
const authSubmit = document.getElementById('auth-submit');
let authMode = 'login';

function setAuthStatus(message, isError = false) {
  authStatus.textContent = message;
  authStatus.classList.toggle('is-error', isError);
}

function renderAuthMode() {
  const isSignup = authMode === 'signup';
  document.getElementById('auth-form-label').textContent = isSignup ? 'AKUN BARU' : 'AKUN';
  document.getElementById('auth-heading').textContent = isSignup ? 'Buat akun' : 'Masuk';
  authSubmit.textContent = isSignup ? 'Buat akun' : 'Masuk';
  authForm.elements.password.autocomplete = isSignup ? 'new-password' : 'current-password';
  document.getElementById('auth-mode-toggle').textContent = isSignup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Buat akun';
}

document.getElementById('auth-mode-toggle').addEventListener('click', () => {
  authMode = authMode === 'login' ? 'signup' : 'login';
  authForm.reset();
  renderAuthMode();
  setAuthStatus(authMode === 'signup' ? 'Akun baru dimulai dengan portfolio kosong.' : 'Masuk untuk membuka portfolio akunmu.');
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!authClient) {
    setAuthStatus('Akun belum dikonfigurasi. Periksa supabase-config.js.', true);
    return;
  }

  authSubmit.disabled = true;
  setAuthStatus(authMode === 'signup' ? 'Membuat akun…' : 'Memeriksa akun…');
  try {
    const credentials = {
      email: authForm.elements.email.value.trim(),
      password: authForm.elements.password.value
    };
    const redirectPath = location.pathname.replace(/login\.html$/, 'index.html');
    const { data, error } = authMode === 'signup'
      ? await authClient.auth.signUp({ ...credentials, options: { emailRedirectTo: `${location.origin}${redirectPath}#creators` } })
      : await authClient.auth.signInWithPassword(credentials);
    if (error) throw error;
    if (authMode === 'signup' && !data.session) {
      authMode = 'login';
      authForm.reset();
      renderAuthMode();
      setAuthStatus('Akun dibuat. Periksa email untuk konfirmasi, lalu masuk.');
      return;
    }
    location.replace(`index.html${location.hash === '#creators' ? '#creators' : ''}`);
  } catch (error) {
    setAuthStatus(error.message || 'Akun tidak dapat diproses.', true);
  } finally {
    authSubmit.disabled = false;
  }
});

if (!authClient) {
  setAuthStatus('Akun belum dikonfigurasi. Periksa supabase-config.js.', true);
} else {
  authClient.auth.getSession().then(({ data, error }) => {
    if (error) setAuthStatus(`Sesi akun tidak dapat dibaca: ${error.message}`, true);
    else if (data.session) location.replace('index.html');
  });
}