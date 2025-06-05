/**
 * Error Page JavaScript
 * Magical error page interactions and auto-redirect functionality
 */

// Error page functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('Error page loaded');
    
    // Auto-redirect to home after 30 seconds of inactivity
    let redirectTimer = setTimeout(() => {
        showNotification('Returning to the home plane...', 'info');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    }, 30000);
    
    // Cancel redirect if user interacts
    function cancelRedirect() {
        clearTimeout(redirectTimer);
        console.log('Auto-redirect cancelled due to user interaction');
    }
    
    document.addEventListener('click', cancelRedirect);
    document.addEventListener('keypress', cancelRedirect);
    document.addEventListener('scroll', cancelRedirect);
    
    // Add hover effects to mana symbols
    document.querySelectorAll('.mana-symbol').forEach((symbol, index) => {
        symbol.style.animationDelay = `${index * 200}ms`;
        symbol.classList.add('animate-float');
        
        symbol.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.2) rotate(10deg)';
            this.style.transition = 'transform 0.3s ease';
        });
        
        symbol.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
    });
    
    // Add sparkle effect to the error icon
    const errorIcon = document.querySelector('.arena-card .w-24.h-24');
    if (errorIcon) {
        let sparkleInterval = setInterval(() => {
            errorIcon.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.5)';
            setTimeout(() => {
                errorIcon.style.boxShadow = '';
            }, 500);
        }, 2000);
        
        // Clean up interval on page unload
        window.addEventListener('beforeunload', () => {
            clearInterval(sparkleInterval);
        });
    }
    
    // Enhanced button interactions
    document.querySelectorAll('.arena-button, a[class*="arena"]').forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05)';
            this.style.transition = 'transform 0.2s ease';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
        
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 100);
        });
    });
    
    // Add keyboard shortcut to return home (Escape key)
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            console.log('Escape key pressed, returning to home');
            showNotification('Returning to home plane...', 'info');
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    });
    
    // Show a helpful tip after 10 seconds
    setTimeout(() => {
        if (document.hasFocus()) {
            showNotification('💡 Press Escape to quickly return home', 'info');
        }
    }, 10000);
});
