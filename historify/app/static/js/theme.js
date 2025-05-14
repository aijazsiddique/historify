/**
 * Theme toggling functionality for Historify app
 */

document.addEventListener('DOMContentLoaded', () => {
  // Get the theme toggle element
  const themeToggle = document.getElementById('theme-toggle');
  
  // Check for saved theme preference or use device preference
  const savedTheme = localStorage.getItem('historify-theme');
  let currentTheme;
  
  if (savedTheme) {
    currentTheme = savedTheme;
    document.documentElement.setAttribute('data-theme', currentTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    currentTheme = 'dark';
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    currentTheme = 'light';
  }
  
  // Set the initial state of the toggle based on the current theme
  if (themeToggle) {
    // If current theme is dark, the toggle should show the sun (to switch to light)
    // If current theme is light, the toggle should show the moon (to switch to dark)
    themeToggle.classList.toggle('swap-active', currentTheme === 'dark');
    
    // Add event listener for the toggle
    themeToggle.addEventListener('click', () => {
      // Get the current theme
      const currentTheme = document.documentElement.getAttribute('data-theme');
      
      // Toggle the theme
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      
      // Toggle the active state of the swap component
      themeToggle.classList.toggle('swap-active');
    });
  }
});

/**
 * Set the theme and save preference to localStorage
 * @param {string} theme - Theme name ('light' or 'dark')
 */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('historify-theme', theme);
  
  // Dispatch a custom event for other components to react to theme changes
  const themeChangeEvent = new CustomEvent('themeChange', { detail: { theme } });
  document.dispatchEvent(themeChangeEvent);
  
  // Log theme change
  console.log(`Theme changed to ${theme}`);
}
