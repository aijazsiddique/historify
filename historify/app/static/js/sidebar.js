/**
 * Sidebar navigation functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarTexts = document.querySelectorAll('.sidebar-text');
    
    // Check localStorage for sidebar state
    const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    
    // Apply initial state
    if (isSidebarCollapsed) {
        sidebar.classList.add('collapsed');
        sidebarTexts.forEach(text => text.style.display = 'none');
    }
    
    // Toggle sidebar
    sidebarToggle.addEventListener('click', function() {
        const isCollapsed = sidebar.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand
            sidebar.classList.remove('collapsed');
            setTimeout(() => {
                sidebarTexts.forEach(text => text.style.display = 'block');
            }, 150);
            localStorage.setItem('sidebarCollapsed', 'false');
        } else {
            // Collapse
            sidebarTexts.forEach(text => text.style.display = 'none');
            sidebar.classList.add('collapsed');
            localStorage.setItem('sidebarCollapsed', 'true');
        }
    });
    
    // Add tooltips for collapsed state
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            if (sidebar.classList.contains('collapsed')) {
                const text = this.querySelector('.sidebar-text').textContent;
                this.setAttribute('title', text);
            }
        });
        
        link.addEventListener('mouseleave', function() {
            this.removeAttribute('title');
        });
    });
});