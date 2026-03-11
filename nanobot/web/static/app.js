// nanobot Web UI - Client-side JavaScript

class NanobotChat {
    constructor() {
        this.ws = null;
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.messagesContainer = document.getElementById('messages');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.init();
    }

    init() {
        // Event listeners
        document.getElementById('chatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        document.querySelectorAll('.action-button').forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                this.sendQuickAction(action);
            });
        });

        this.messageInput.addEventListener('input', () => {
            this.sendButton.disabled = !this.messageInput.value.trim();
        });

        // Connect to WebSocket
        this.connect();

        // Focus input on load
        this.messageInput.focus();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;

        this.updateStatus('connecting');

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.updateStatus('connected');
            this.sendButton.disabled = false;
            this.addSystemMessage('Connected to nanobot 🐈');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateStatus('disconnected');
            this.sendButton.disabled = true;
            this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.addSystemMessage('Connection error. Attempting to reconnect...');
        };
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
            this.addSystemMessage(`Reconnecting in ${delay / 1000}s... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            this.addSystemMessage('Unable to connect. Please refresh the page to try again.');
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'system':
                this.addSystemMessage(data.content);
                break;
            case 'message':
                this.addAssistantMessage(data.content);
                break;
            case 'pong':
                // Heartbeat response
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        // Add user message to chat
        this.addUserMessage(content);

        // Send to server
        this.ws.send(JSON.stringify({
            type: 'message',
            content: content,
            sender_id: this.getSenderId()
        }));

        // Clear input
        this.messageInput.value = '';
        this.sendButton.disabled = true;

        // Show typing indicator
        this.showTypingIndicator();
    }

    sendQuickAction(action) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'message',
            content: action,
            sender_id: this.getSenderId()
        }));
    }

    getSenderId() {
        let senderId = localStorage.getItem('nanobot_sender_id');
        if (!senderId) {
            senderId = 'web_user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('nanobot_sender_id', senderId);
        }
        return senderId;
    }

    addUserMessage(content) {
        this.addMessage('user', content);
    }

    addAssistantMessage(content) {
        this.hideTypingIndicator();
        this.addMessage('assistant', content);
    }

    addSystemMessage(content) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message system';
        messageEl.innerHTML = `<div class="message-content">${this.escapeHtml(content)}</div>`;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    addMessage(type, content) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;

        // Format content (basic markdown support)
        const formattedContent = this.formatContent(content);

        messageEl.innerHTML = `<div class="message-content">${formattedContent}</div>`;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    formatContent(content) {
        if (!content) return '';

        // Escape HTML first
        let formatted = this.escapeHtml(content);

        // Code blocks
        formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
        });

        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showTypingIndicator() {
        let indicator = document.getElementById('typingIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'typingIndicator';
            indicator.className = 'message assistant';
            indicator.innerHTML = `
                <div class="message-content">
                    <div class="typing-indicator">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            `;
            this.messagesContainer.appendChild(indicator);
        }
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    updateStatus(status) {
        this.statusDot.className = 'status-dot';
        if (status === 'connected') {
            this.statusDot.classList.add('connected');
            this.statusText.textContent = 'Connected';
        } else if (status === 'connecting') {
            this.statusText.textContent = 'Connecting...';
        } else {
            this.statusText.textContent = 'Disconnected';
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new NanobotChat();
});
