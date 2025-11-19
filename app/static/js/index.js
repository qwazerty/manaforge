/**
 * Homepage JavaScript
 * Simple interactivity for the ManaForge homepage
 */

// Homepage functionality
document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scroll behavior for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Add hover effects to feature cards
    document.querySelectorAll('.arena-card').forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });
    
    // Add floating animation to mana symbols
    document.querySelectorAll('.mana-symbol').forEach((symbol, index) => {
        symbol.style.animationDelay = `${index * 200}ms`;
        symbol.classList.add('animate-float');
    });
    
    // Preload critical pages for faster navigation
    const criticalPages = ['/game', '/cards'];
    criticalPages.forEach(page => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = page;
        document.head.appendChild(link);
    });
});
