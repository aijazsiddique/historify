/**
 * Theme toggling functionality for Historify app
 */

// Check for saved theme preference or use device preference
document.addEventListener('DOMContentLoaded', () => {
  // Check for saved theme preference or use device preference
  const savedTheme = localStorage.getItem('historify-theme');
  
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Set up theme toggle buttons
  const themeLight = document.getElementById('theme-light');
  const themeDark = document.getElementById('theme-dark');

  if (themeLight) {
    themeLight.addEventListener('click', () => setTheme('light'));
  }
  
  if (themeDark) {
    themeDark.addEventListener('click', () => setTheme('dark'));
  }
});

/**
 * Set the theme and save preference to localStorage
 * @param {string} theme - Theme name ('light' or 'dark')
 */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('historify-theme', theme);
  
  // Close dropdown if it's open
  const dropdowns = document.querySelectorAll('.dropdown-content');
  dropdowns.forEach(dropdown => {
    dropdown.removeAttribute('open');
  });
}
