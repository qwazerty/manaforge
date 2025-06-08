/**
 * ManaForge UI Notifications Module
 * Handles notifications, feedback, and status indicators
 */

class UINotifications {
    static NOTIFICATION_TYPES = {
        info: 'notification-info',
        success: 'notification-success',
        warning: 'notification-warning',
        error: 'notification-error'
    };

    static NOTIFICATION_DURATION = 3000; // 3 seconds
    static FADE_DURATION = 500; // 0.5 seconds

    /**
     * Show notification message
     */
    static showNotification(message, type = 'info') {
        console.log(`[${type}] ${message}`);
        
        const notification = this.createNotificationElement(message, type);
        const notificationsArea = this.getNotificationsArea();
        
        if (notificationsArea) {
            notificationsArea.appendChild(notification);
            this.scheduleNotificationRemoval(notification);
        }
    }

    /**
     * Show auto refresh indicator
     */
    static showAutoRefreshIndicator(message, type = 'info') {
        const indicator = document.getElementById('auto-refresh-indicator');
        if (!indicator) return;
        
        indicator.textContent = message;
        indicator.className = `auto-refresh-indicator auto-refresh-${type}`;
        indicator.style.display = 'block';
        
        // Add flash animation
        indicator.classList.add('auto-refresh-flash');
        setTimeout(() => {
            indicator.classList.remove('auto-refresh-flash');
        }, 1000);
        
        // Auto hide after 2 seconds
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 2000);
    }

    /**
     * Add chat message
     */
    static addChatMessage(sender, message) {
        const chatArea = document.getElementById('chat-area');
        if (!chatArea) return;
        
        const messageElement = this.createChatMessageElement(sender, message);
        chatArea.appendChild(messageElement);
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    /**
     * Show loading indicator
     */
    static showLoadingIndicator(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = this.generateLoadingHTML(message);
    }

    /**
     * Show success feedback
     */
    static showSuccessFeedback(message) {
        this.showNotification(message, 'success');
        this.showAutoRefreshIndicator(message, 'success');
    }

    /**
     * Show error feedback
     */
    static showErrorFeedback(message, error = null) {
        const errorMessage = error ? `${message}: ${error.message}` : message;
        this.showNotification(errorMessage, 'error');
        this.showAutoRefreshIndicator('Error occurred', 'error');
        console.error(message, error);
    }

    /**
     * Show warning feedback
     */
    static showWarningFeedback(message) {
        this.showNotification(message, 'warning');
        this.showAutoRefreshIndicator(message, 'warning');
    }

    /**
     * Clear all notifications
     */
    static clearAllNotifications() {
        const notificationsArea = this.getNotificationsArea();
        if (notificationsArea) {
            notificationsArea.innerHTML = '';
        }
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Create notification element
     */
    static createNotificationElement(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${this.NOTIFICATION_TYPES[type] || this.NOTIFICATION_TYPES.info}`;
        notification.innerHTML = this.generateNotificationHTML(message, type);
        return notification;
    }

    /**
     * Create chat message element
     */
    static createChatMessageElement(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.innerHTML = `
            <span class="chat-sender">${this.escapeHtml(sender)}:</span>
            <span class="chat-text">${this.escapeHtml(message)}</span>
        `;
        return messageElement;
    }

    /**
     * Get notifications area
     */
    static getNotificationsArea() {
        let notificationsArea = document.getElementById('notifications-area');
        
        // Create notifications area if it doesn't exist
        if (!notificationsArea) {
            notificationsArea = this.createNotificationsArea();
        }
        
        return notificationsArea;
    }

    /**
     * Create notifications area
     */
    static createNotificationsArea() {
        const notificationsArea = document.createElement('div');
        notificationsArea.id = 'notifications-area';
        notificationsArea.className = 'notifications-area fixed top-4 left-4 z-50';
        
        // Try to append to body, fallback to document.documentElement
        try {
            document.body.appendChild(notificationsArea);
        } catch (error) {
            console.warn('Could not append to body, trying documentElement');
            document.documentElement.appendChild(notificationsArea);
        }
        
        return notificationsArea;
    }

    /**
     * Schedule notification removal
     */
    static scheduleNotificationRemoval(notification) {
        setTimeout(() => {
            notification.classList.add('notification-hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, this.FADE_DURATION);
        }, this.NOTIFICATION_DURATION);
    }

    /**
     * Generate notification HTML
     */
    static generateNotificationHTML(message, type) {
        const icon = this.getNotificationIcon(type);
        return `
            <div class="notification-content">
                <span class="notification-icon">${icon}</span>
                <span class="notification-message">${this.escapeHtml(message)}</span>
            </div>
        `;
    }

    /**
     * Generate loading HTML
     */
    static generateLoadingHTML(message) {
        return `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-message">${this.escapeHtml(message)}</div>
            </div>
        `;
    }

    /**
     * Get notification icon based on type
     */
    static getNotificationIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || icons.info;
    }

    /**
     * Escape HTML characters
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.UINotifications = UINotifications;
