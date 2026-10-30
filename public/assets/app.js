const preferencesKey = 'lumen-gallery-preferences';
const saved = JSON.parse(localStorage.getItem(preferencesKey) || '{}');
const root = document.documentElement;
const setPreference = (key, value) => {
  saved[key] = value;
  localStorage.setItem(preferencesKey, JSON.stringify(saved));
};
const applyPreferences = () => {
  root.dataset.theme = saved.theme || 'dark';
  root.dataset.density = saved.density || 'spacious';
  root.dataset.labels = saved.labels === false ? 'hidden' : 'visible';
  const themeChoice = document.querySelector('#theme-choice');
  const densityChoice = document.querySelector('#density-choice');
  const labelsChoice = document.querySelector('#labels-choice');
  if (themeChoice) themeChoice.value = root.dataset.theme;
  if (densityChoice) densityChoice.value = root.dataset.density;
  if (labelsChoice) labelsChoice.checked = root.dataset.labels !== 'hidden';
};
applyPreferences();
const settings = document.querySelector('#settings');
document.querySelector('#settings-toggle')?.addEventListener('click', () => settings?.showModal());
document.querySelector('#theme-toggle')?.addEventListener('click', () => {
  setPreference('theme', root.dataset.theme === 'light' ? 'dark' : 'light');
  applyPreferences();
});
document.querySelector('#theme-choice')?.addEventListener('change', (event) => {
  setPreference('theme', event.target.value);
  applyPreferences();
});
document.querySelector('#density-choice')?.addEventListener('change', (event) => {
  setPreference('density', event.target.value);
  applyPreferences();
});
document.querySelector('#labels-choice')?.addEventListener('change', (event) => {
  setPreference('labels', event.target.checked);
  applyPreferences();
});

const dialog = document.querySelector('#lightbox');
if (dialog) {
  const image = document.querySelector('#lightbox-image');
  const filename = document.querySelector('#lightbox-filename');
  const meta = document.querySelector('#lightbox-meta');
  document.querySelectorAll('.photo').forEach((button) => button.addEventListener('click', () => {
    const data = JSON.parse(button.dataset.meta || '{}');
    image.src = button.dataset.large;
    image.alt = button.dataset.filename || '';
    filename.textContent = button.dataset.filename || '';
    meta.innerHTML = Object.entries(data).filter(([, value]) => value).map(([key, value]) => `<dt>${key.replace(/[A-Z]/g, (letter) => ` ${letter}`).toUpperCase()}</dt><dd>${value}</dd>`).join('');
    dialog.showModal();
  }));
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
}
