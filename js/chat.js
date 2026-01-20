//v 20_01
// Filter coach/AI text: remove bold, asterisks, headers, preserve newlines as <br>
import { loadChatHistory, loadCoaches } from '/js/chatApi.js';
import { convertToBase64, resizeImage } from '/js/mediaUtils.js';
import { DEFAULT_AVATAR } from '/js/constants.js';
import { API_BASE_URL } from '/js/config.js';

let chatHistory = new Map(); // Store chat history by coach ID
let activeCoachId = null; // Track current active coach
document.addEventListener('DOMContentLoaded', () => {
    const coachList = document.querySelector('.chatbot-list');
    const chatMessages = document.querySelector('.chat-messages');
    const messageInput = document.querySelector('textarea');
    const sendButton = document.querySelector('.send-btn');
    const chatInput = document.querySelector('.chat-input');

    // Hide coach list panel initially
    const coachListPanel = document.querySelector('.coach-list-panel') || document.querySelector('.col-lg-3');
    if (coachListPanel) coachListPanel.style.display = 'none';

    // Add preview container after chat input initialization
    chatInput.insertAdjacentHTML('afterbegin', `
        <div class="media-preview-container d-flex flex-wrap gap-2 my-2"></div>
    `);
    
    function filterCoachText(text) {
        console.log('filterCoachText');
    return (text || '')
        .replace(/#+\s*/g, '')
        .replace(/\*\*(.*?)\*\*/gs, '$1')
        .replace(/\*/g, '')
        .split(/\r?\n/).map(line => line.trim()).join('<br>');
    }

    async function loadCoachesList() {
        try {
            let coaches, history;
            // Check for coach param in URL
            const urlParams = new URLSearchParams(window.location.search);
            const coachIdParam = urlParams.get('coach');

            // Show initial loading spinner (if present)
            const initialSpinner = document.getElementById('initialLoadingSpinner');
            if (initialSpinner) initialSpinner.style.display = 'block';

            try {
                coaches = await loadCoaches();
                if (coachIdParam) {
                    // Only load chat history for the selected coach
                    history = await loadChatHistory(coachIdParam);
                } else {
                    // Load all chat history
                    history = await loadChatHistory();
                }
            } catch (historyError) {
                // If error is "No user logged in", show toast and proceed with empty history
                if (historyError && historyError.message && historyError.message.includes('No user logged in')) {
                    // Show plain English toast
                    if (window.showToast) window.showToast('Please log in to view the chat.', false);
                    else showToast('Please log in to view the chat.', false);
                    history = [];
                } else {
                    throw historyError;
                }
            }

            if (!Array.isArray(coaches)) {
                throw new Error('Invalid coaches data');
            }

            // Initialize chat history
            chatHistory = new Map();
            if (Array.isArray(history)) {
                if (coachIdParam) {
                    // Only one coach's history, so use coachIdParam
                    chatHistory.set(coachIdParam, history);
                } else {
                    // Group messages by coachId into arrays
                    history.forEach(item => {
                        if (!chatHistory.has(item.coachId)) {
                            chatHistory.set(item.coachId, []);
                        }
                        chatHistory.get(item.coachId).push(item);
                    });
                }
            }

            renderCoaches(coaches);

            if (coachIdParam) {
                // Hide coach list (already hidden by default)
                // Auto-select the coach by clicking the card if present
                const coachCard = document.querySelector(`.coach-item[data-id="${coachIdParam}"]`);
                if (coachCard) {
                    coachCard.click();
                } else if (!coachList) {
                    // No left panel: activate header and messages directly from data
                    const coach = coaches.find(c => String(c.id) === String(coachIdParam)) || coaches[0];
                    if (coach) {
                        const status = getStoredStatus(coach.id) || coach.status || getRandomStatus();
                        storeStatus(coach.id, status);
                        const headerAvatar = document.getElementById('chatCoachAvatar');
                        const headerName = document.getElementById('chatCoachName');
                        const headerRole = document.getElementById('chatCoachRole');
                        const headerStatus = document.getElementById('chatCoachStatus');
                        if (headerAvatar) {
                            headerAvatar.style.backgroundImage = `url('${coach.avatar || DEFAULT_AVATAR}')`;
                        }
                        if (headerStatus) {
                            headerStatus.className = `coach-status status-${status}`;
                            headerStatus.style.display = 'block';
                        }
                        if (headerName) headerName.textContent = coach.name;
                        if (headerRole) headerRole.textContent = coach.role || '';
                        activeCoachId = String(coach.id);
                        renderMessagesForCoach(activeCoachId);
                    }
                } else {
                    // If not found, select first coach
                    const firstCoach = document.querySelector('.coach-item');
                    if (firstCoach) firstCoach.click();
                }
            } else {
                // Show coach list panel if no coach param
                if (coachListPanel) coachListPanel.style.display = '';
                // Optionally, auto-select the first coach and restore its chat
                const firstCoach = document.querySelector('.coach-item');
                if (firstCoach) {
                    firstCoach.click();
                } else if (!coachList && coaches.length) {
                    const coach = coaches[0];
                    const status = getStoredStatus(coach.id) || coach.status || getRandomStatus();
                    storeStatus(coach.id, status);
                    const headerAvatar = document.getElementById('chatCoachAvatar');
                    const headerName = document.getElementById('chatCoachName');
                    const headerRole = document.getElementById('chatCoachRole');
                    const headerStatus = document.getElementById('chatCoachStatus');
                    if (headerAvatar) {
                        headerAvatar.style.backgroundImage = `url('${coach.avatar || DEFAULT_AVATAR}')`;
                    }
                    if (headerStatus) {
                        headerStatus.className = `coach-status status-${status}`;
                        headerStatus.style.display = 'block';
                    }
                    if (headerName) headerName.textContent = coach.name;
                    if (headerRole) headerRole.textContent = coach.role + " expert" || '';
                    activeCoachId = String(coach.id);
                    renderMessagesForCoach(activeCoachId);
                }
            }
        } catch (error) {
            console.error('Error loading coaches:', error);
            const msg = window.showToast ? null : 'Failed to load coaches. Please try refreshing the page.';
            if (msg) {
                chatMessages.innerHTML = `
                    <div class="alert alert-danger">
                        ${msg}
                    </div>
                `;
            } else {
                // If global showToast exists, show plain English toast
                if (window.showToast) window.showToast('Failed to load coaches.', false);
            }
        }
        finally {
            const initialSpinner = document.getElementById('initialLoadingSpinner');
            if (initialSpinner) initialSpinner.style.display = 'none';
        }
    }

    function getRandomStatus() {
        const statuses = ['online', 'away', 'offline'];
        return statuses[Math.floor(Math.random() * statuses.length)];
    }

    function getStoredStatus(coachId) {
        const storedStatuses = JSON.parse(sessionStorage.getItem('coachStatuses') || '{}');
        return storedStatuses[coachId];
    }

    function storeStatus(coachId, status) {
        const storedStatuses = JSON.parse(sessionStorage.getItem('coachStatuses') || '{}');
        storedStatuses[coachId] = status;
        sessionStorage.setItem('coachStatuses', JSON.stringify(storedStatuses));
    }

    function renderCoaches(coaches) {
        coachList.innerHTML = coaches.map(coach => {
            const storedStatus = getStoredStatus(coach.id);
            const status = storedStatus || coach.status || getRandomStatus();
            if (!storedStatus) {
                storeStatus(coach.id, status);
            }
            return `
                <div class="coach-item d-flex align-items-center gap-3" data-id="${coach.id}" data-status="${status}">
                    <div class="coach-item-avatar" style="background-image: url('${coach.avatar || DEFAULT_AVATAR}')">
                        <div class="coach-status status-${status}"></div>
                    </div>
                    <div>
                        <h6 class="mb-0">${coach.name}</h6>
                        <small class="text-muted">${coach.role} expert</small>
                    </div>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.coach-item').forEach(item => {
            item.addEventListener('click', () => selectCoach(item));
        });
    }

    function setCoachStatus(coachId, status, force = false) {
        const coachItem = document.querySelector(`.coach-item[data-id="${coachId}"]`);
        const typingIndicator = document.querySelector('.typing-indicator');
        const headerStatus = document.getElementById('chatCoachStatus');
        
        if (status === 'responding') {
            // Show typing indicator
            if (typingIndicator) {
                const coachName = document.getElementById('chatCoachName')?.textContent || 'Coach';
                typingIndicator.querySelector('span').innerHTML = `<i class="bi bi-keyboard me-2"></i>${coachName}`;
                typingIndicator.classList.remove('d-none');
            }
        } else {
            // Hide typing indicator
            if (typingIndicator) typingIndicator.classList.add('d-none');
            
            // Update avatar status dot
            if (headerStatus) {
                headerStatus.className = `coach-status status-${status}`;
                headerStatus.style.display = 'block';
            }
            
            // Update coach item in list if present
            if (coachItem) {
                const currentStatus = coachItem.dataset.status;
                if (status !== currentStatus || force) {
                    coachItem.dataset.status = status;
                    const statusDot = coachItem.querySelector('.coach-status');
                    if (statusDot) statusDot.className = `coach-status status-${status}`;
                }
            }
        }

        if (status !== 'responding') {
            storeStatus(coachId, status);
        }
    }

    // Helper to fix mojibake (bad encoding) in loaded chat history
function fixMojibake(str) {
    if (!str || typeof str !== 'string') return str;
    try {
        // Decode as if misinterpreted as Latin-1 instead of UTF-8 (modern, no deprecated escape)
        return decodeURIComponent(encodeURIComponent(str));
    } catch (e) {
        return str;
    }
}

// Helper: Render messages for a specific coachId into the chatMessages container
function renderMessagesForCoach(coachId) {
    chatMessages.innerHTML = '';
    const coachHistory = chatHistory.get(coachId) || [];
    let lastDate = null;
    let lastDateStr = null;
    coachHistory.forEach((msg, idx) => {
        // Normalize message fields for UI compatibility
        const isUser = typeof msg.isUser !== 'undefined' ? msg.isUser : !!msg.user;
        const isAudio = !!msg.isAudio;
        const isImage = !!msg.isImage;
        const content = fixMojibake(msg.content || msg.text || '');
        // Only use timestamp if present and is a valid number
        let timestamp = '';
        if (typeof msg.timestamp !== 'undefined' && msg.timestamp !== null && !isNaN(Number(msg.timestamp)) && Number(msg.timestamp) > 0) {
            timestamp = msg.timestamp;
        }
        // Insert date separator if date changes
        let dateToCheck = timestamp ? (Number(timestamp) < 2000000000 ? Number(timestamp) * 1000 : Number(timestamp)) : null;
        let dateStr = '';
        if (dateToCheck) {
            const msgDate = new Date(dateToCheck);
            const today = new Date();
            const yesterday = new Date();
            msgDate.setHours(0,0,0,0);
            today.setHours(0,0,0,0);
            yesterday.setDate(today.getDate() - 1);
            yesterday.setHours(0,0,0,0);
            if (!lastDate || msgDate.getTime() !== lastDate.getTime()) {
                if (msgDate.getTime() === today.getTime()) {
                    dateStr = 'Today';
                } else if (msgDate.getTime() === yesterday.getTime()) {
                    dateStr = 'Yesterday';
                } else {
                    dateStr = msgDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                }
                // Only insert separator if not the very first message, or if the first message is not today
                if (idx === 0 || dateStr !== lastDateStr) {
                    const sep = document.createElement('div');
                    sep.className = 'chat-date-separator text-center text-muted my-2';
                    sep.textContent = dateStr;
                    chatMessages.appendChild(sep);
                    lastDate = new Date(msgDate.getTime());
                    lastDateStr = dateStr;
                }
            }
        }
        addMessage(content, isUser, isAudio, isImage, timestamp, false);
    });
}

// Modified handleTextMessage to only update DOM if user is still on the same coach
async function handleTextMessage(message, coachId, originalStatus) {
    const targetCoachId = coachId;

    // Save user message to the correct chat history
    if (!chatHistory.has(targetCoachId)) chatHistory.set(targetCoachId, []);
    chatHistory.get(targetCoachId).push({
        content: message,
        isUser: true,
        timestamp: Date.now()
    });
    // No need to save chat history, server handles it

    // Only render if user is still on this coach
    if (activeCoachId === targetCoachId) {
        addMessage(message, true);
    }

    try {
        if (originalStatus === 'online' && activeCoachId === targetCoachId) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            setCoachStatus(targetCoachId, 'responding');
        } else if (originalStatus !== 'online' && activeCoachId === targetCoachId) {
            // Wait 2 seconds (coach gets notification)
            await new Promise(resolve => setTimeout(resolve, 2000));
            // Change status to online
            setCoachStatus(targetCoachId, 'online');
            // Wait another 1.5 seconds (coach reads message)
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Show typing indicator
            setCoachStatus(targetCoachId, 'responding');
        }

        const initialDelay = getResponseDelay(originalStatus);
        await new Promise(resolve => setTimeout(resolve, initialDelay));

        const reply = await sendToServer(message, targetCoachId);

        // Save coach reply to the correct chat history
        chatHistory.get(targetCoachId).push({
            content: reply,
            isUser: false,
            timestamp: Date.now()
        });
        // No need to save chat history, server handles it

        // Only render if user is still on this coach
        if (activeCoachId === targetCoachId) {
            const typingDelay = calculateTypingDelay(reply);
            await new Promise(resolve => setTimeout(resolve, typingDelay));
            addMessage(reply, false);
            setCoachStatus(targetCoachId, 'online');
        }
        // If not, do not update DOM. When user switches back, renderMessagesForCoach will show all messages.
    } catch (error) {
    chatHistory.get(targetCoachId).push({
            content: `
                <div class="alert alert-danger mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    ${error.message}
                </div>
            `,
            isUser: false,
            timestamp: Date.now()
        });
        // No need to save chat history, server handles it

        if (activeCoachId === targetCoachId) {
            addMessage(`
                <div class="alert alert-danger mb-0">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    ${error.message}
                </div>
            `, false);
            setCoachStatus(targetCoachId, originalStatus);
        }
    }
}

    function selectCoach(coachItem) {
        const newCoachId = coachItem.dataset.id;
        // Store current messages for previous coach if any
        if (activeCoachId) {
            const messages = Array.from(chatMessages.children).map(msg => {
                const contentElem = msg.querySelector('.message-content');
                let content = '';
                // Detect if this is an image/AI message (array/object) by checking for .ai-markdown or .bi-image
                if (contentElem && contentElem.querySelector('.bi-image')) {
                    // Image/AI message: store as array/object
                    const flexGrow = contentElem.querySelector('.flex-grow-1');
                    if (flexGrow) {
                        // Try to parse as JSON if possible, otherwise fallback to HTML
                        try {
                            content = JSON.parse(flexGrow.textContent);
                        } catch {
                            content = flexGrow.innerHTML;
                        }
                    } else {
                        content = contentElem.innerHTML;
                    }
                } else if (contentElem && contentElem.querySelector('audio')) {
                    // Voice message: store audio src
                    const audio = contentElem.querySelector('audio');
                    content = audio ? audio.src : '';
                } else if (contentElem) {
                    // Text message: store plain text
                    const flexGrow = contentElem.querySelector('.flex-grow-1');
                    content = flexGrow ? flexGrow.textContent : contentElem.textContent || '';
                }
                return {
                    content,
                    isUser: msg.classList.contains('user'),
                    timestamp: parseInt(msg.dataset.timestamp)
                };
            });
            chatHistory.set(activeCoachId, messages);
            // Save chat history after switching
            // No need to save chat history, server handles it
        }
        
        document.querySelectorAll('.coach-item').forEach(item => item.classList.remove('active'));
        coachItem.classList.add('active');

        // Update chat header with selected coach info
        const status = coachItem.dataset.status;
        const avatar = coachItem.querySelector('.coach-item-avatar').style.backgroundImage;
        const name = coachItem.querySelector('h6').textContent;
        const role = coachItem.querySelector('small').textContent;

        const headerAvatar = document.getElementById('chatCoachAvatar');
        if (headerAvatar) {
            headerAvatar.style.backgroundImage = avatar;
        }
        const headerStatus = document.getElementById('chatCoachStatus');
        if (headerStatus) {
            headerStatus.className = `coach-status status-${status}`;
            headerStatus.style.display = 'block';
        }
        document.getElementById('chatCoachName').textContent = name;
        document.getElementById('chatCoachRole').textContent = role;
        
        // Load chat history for selected coach
        activeCoachId = newCoachId;
        renderMessagesForCoach(newCoachId);
    }

function addMessage(content, isUser = false, isAudio = false, timestamp = Date.now()) {
        const message = document.createElement('div');
        message.className = `message ${isUser ? 'user' : ''}`;
        message.dataset.timestamp = timestamp;
        
        // Add delete button for user messages
        const deleteButton = isUser ? `
            <button class="btn btn-link btn-sm text-muted delete-message p-0 ms-2" title="Delete message">
                <i class="bi bi-trash"></i>
            </button>
        ` : '';

        let messageContent = '';
        // Handle array content (for images, etc.)
        if (Array.isArray(content)) {
            // Separate image and text parts
            let imagePart = content.find(part => part.type === 'image_url' && part.image_url && part.image_url.url);
            let textPart = content.find(part => part.type === 'text' && part.text);
            let imageHtml = '';
            let textHtml = '';
            if (imagePart) {
                imageHtml = `
                    <div class="image-preview-block mb-2 text-center">
                        <img src="${imagePart.image_url.url}" class="img-fluid rounded" style="max-height: 200px; cursor: pointer;" onclick="window.open(this.src, '_blank')" alt="Uploaded image">
                    </div>
                `;
            }
            if (textPart) {
                let filtered = filterCoachText(textPart.text || '');
                textHtml = `<div class="ai-markdown">${filtered}</div>`;
            }
            messageContent = `
                <div class="image-message-wrapper">
                    ${imageHtml}
                    ${textHtml}
                </div>
            `;
        } else if (typeof content === 'string') {
            // Voice message: render with icon and audio player if isAudio is true
            if (isAudio) {
                messageContent = `
                    <div class="audio-message-block d-flex align-items-center gap-2">
                        <i class="bi bi-mic-fill text-primary"></i>
                        <audio src="${content}" controls class="audio-message flex-grow-1"></audio>
                    </div>
                `;
            } else if (!isUser) {
                // Filter coach/AI messages for formatting
                let filtered = filterCoachText(content);
                messageContent = `<div class=\"ai-markdown\">${filtered}</div>`;
            } else {
                messageContent = content;
            }
        }

        // Format time for timestamp (date is now in separator)
        let timeStr = '';
        if (timestamp && !isNaN(Number(timestamp)) && Number(timestamp) > 0) {
            const dateObj = new Date(Number(timestamp) < 2000000000 ? Number(timestamp) * 1000 : Number(timestamp));
            timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        message.innerHTML = `
            <div class="message-content">
                <div class="d-flex align-items-center justify-content-between">
                    <div class="flex-grow-1">
                        ${messageContent}
                    </div>
                    ${deleteButton}
                </div>
                <div class="message-timestamp text-end text-muted" style="font-size: 0.8em; opacity: 0.7; margin-top: 0.25rem;">
                    ${timeStr}
                </div>
            </div>
        `;

        // Add delete event listener
        if (isUser) {
            const deleteBtn = message.querySelector('.delete-message');
            deleteBtn?.addEventListener('click', () => message.remove());
        }

        chatMessages.appendChild(message);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        // Save chat history after every new message
        if (activeCoachId) {
            const messages = Array.from(chatMessages.children).map(msg => {
                const contentElem = msg.querySelector('.message-content');
                let content = '';
                // Detect if this is an image/AI message (array/object) by checking for .bi-image
                if (contentElem && contentElem.querySelector('.bi-image')) {
                    // Image/AI message: store as array/object
                    const flexGrow = contentElem.querySelector('.flex-grow-1');
                    if (flexGrow) {
                        try {
                            content = JSON.parse(flexGrow.textContent);
                        } catch {
                            content = flexGrow.innerHTML;
                        }
                    } else {
                        content = contentElem.innerHTML;
                    }
                } else if (contentElem && contentElem.querySelector('audio')) {
                    // Voice message: store audio src
                    const audio = contentElem.querySelector('audio');
                    content = audio ? audio.src : '';
                } else if (contentElem) {
                    // Text message: store plain text
                    const flexGrow = contentElem.querySelector('.flex-grow-1');
                    content = flexGrow ? flexGrow.textContent : contentElem.textContent || '';
                }
                return {
                    content,
                    isUser: msg.classList.contains('user'),
                    timestamp: parseInt(msg.dataset.timestamp)
                };
            });
            chatHistory.set(activeCoachId, messages);
            // No need to save chat history, server handles it
        }
    }



    function getResponseDelay(status) {
        switch (status) {
            case 'online':
                return Math.random() * 1000 + 1500; // 1.5-2.5 seconds
            case 'away':
                return Math.random() * 3000 + 4000; // 4-7 seconds
            case 'offline':
                return Math.random() * 5000 + 8000; // 8-13 seconds
            default:
                return 1000;
        }
    }

    function calculateTypingDelay(text) {
        // Average typing speed: ~40 words per minute, or ~300 characters per minute
        const charactersPerSecond = 300 / 60;
        const delay = (text.length / charactersPerSecond) * 1000;
        // Cap the delay between 1 and 10 seconds
        return Math.min(Math.max(delay, 3000), 15000);
    }

    // Rename sendToGPT to sendToServer
    async function sendToServer(message, coachId) {
        try {
            const response = await fetch(`${API_BASE_URL}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chat',
                    coach_id: coachId,
                    message: message
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            return data.reply;
        } catch (error) {
            console.error('Error sending message to server:', error);
            throw new Error(error.message || 'Failed to get response from coach');
        }
    }

    // Handle sending messages
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function sendMessage() {
        // Always capture the input value at the start
        const inputValue = messageInput.value;
        const message = inputValue.trim();
        const audioPreview = document.querySelector('.audio-preview');
        const imagePreview = document.querySelector('.media-preview img');

        // If nothing to send, return
        if (!message && !audioPreview && !imagePreview) return;

        const activeCoach = document.querySelector('.coach-item.active');
        if (!activeCoach) {
            addMessage('<div class="text-danger">Please select a coach first</div>', false);
            return;
        }

        const coachId = activeCoach.dataset.id;
        const originalStatus = activeCoach.dataset.status;

        // If image is present, send image and text together
        if (imagePreview) {
            const base64Image = imagePreview.src.split(',')[1];
            // Remove preview immediately
            imagePreview.closest('.media-preview').remove();
            // Use the captured input value
            const userText = inputValue.trim();
            messageInput.value = '';
            handleImageMessageWithText(base64Image, userText, coachId, originalStatus);
            return; // Do not send text separately
        }

        messageInput.value = '';

        if (audioPreview) {
            handleAudioMessage(audioPreview, coachId, originalStatus);
        }

        if (message) {
            handleTextMessage(message, coachId, originalStatus);
        }
    }

    async function handleTextMessage(message, coachId, originalStatus) {
        const targetCoachId = coachId;

        // Save user message to the correct chat history
        if (!chatHistory.has(targetCoachId)) chatHistory.set(targetCoachId, []);
        chatHistory.get(targetCoachId).push({
            content: message,
            isUser: true,
            timestamp: Date.now()
        });
        // No need to save chat history, server handles it

        // Only render if user is still on this coach
        if (activeCoachId === targetCoachId) {
            addMessage(message, true);
        }

        try {
            if (originalStatus === 'online' && activeCoachId === targetCoachId) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                setCoachStatus(targetCoachId, 'responding');
            }

            const initialDelay = getResponseDelay(originalStatus);
            await new Promise(resolve => setTimeout(resolve, initialDelay));

            const reply = await sendToServer(message, targetCoachId);

            // Save coach reply to the correct chat history
            chatHistory.get(targetCoachId).push({
                content: reply,
                isUser: false,
                timestamp: Date.now()
            });
            // No need to save chat history, server handles it

            // Only render if user is still on this coach
            if (activeCoachId === targetCoachId) {
                const typingDelay = calculateTypingDelay(reply);
                await new Promise(resolve => setTimeout(resolve, typingDelay));
                addMessage(reply, false);
                setCoachStatus(targetCoachId, 'online');
            }
            // If not, do not update DOM. When user switches back, renderMessagesForCoach will show all messages.
        } catch (error) {
            chatHistory.get(targetCoachId).push({
                content: `
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        ${error.message}
                    </div>
                `,
                isUser: false,
                timestamp: Date.now()
            });
            // No need to save chat history, server handles it

            if (activeCoachId === targetCoachId) {
                addMessage(`
                    <div class="alert alert-danger mb-0">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        ${error.message}
                    </div>
                `, false);
                setCoachStatus(targetCoachId, originalStatus);
            }
        }
    }

    async function handleAudioMessage(audioPreview, coachId, originalStatus) {
        const audio = audioPreview.querySelector('audio');
        const audioBlob = await fetch(audio.src).then(r => r.blob());
        
        try {
            addMessage(audio.src, true, true);
            setCoachStatus(coachId, 'responding');

            const formData = new FormData();
            formData.append('action', 'transcribe_audio');
            formData.append('coach_id', coachId);
            formData.append('audio', audioBlob);

            const response = await fetch(`${API_BASE_URL}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();

            if (!data || !data.text) {
                console.log(data)
                throw new Error('Invalid response from server');
            }

            // Add small delay before response
            await new Promise(resolve => setTimeout(resolve, 1000));
            const reply = await sendToServer(data.text, coachId);
            addMessage(reply, false);
            setCoachStatus(coachId, 'online');

        } catch (error) {
            console.error('Audio processing error:', error);
            addMessage(`<span class="text-danger">Failed to process audio message: ${error.message}</span>`, false);
            setCoachStatus(coachId, originalStatus);
        } finally {
            audioPreview.remove();
        }
    }


// New: handle image and text together
async function handleImageMessageWithText(base64Image, userText, coachId, originalStatus) {
    try {
        // Compose content array for local chat display
        const contentArr = [];
        if (userText) {
            contentArr.push({ type: 'text', text: userText });
        }
        contentArr.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64Image } });
        addMessage(contentArr, true);
        setCoachStatus(coachId, 'responding');

        // Convert base64 to blob
        const byteString = atob(base64Image);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: 'image/jpeg' });

        const formData = new FormData();
        formData.append('action', 'vision');
        formData.append('image', blob, 'image.jpg');
        formData.append('coach_id', coachId);
        formData.append('text', userText);

        const res = await fetch(`${API_BASE_URL}`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }

        let data;
        try {
            const text = await res.text();
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('Raw response:', text);
            throw new Error('Invalid response format from server');
        }

        if (data && data.reply) {
            addMessage(data.reply, false);
        } else {
            throw new Error('Missing reply in server response');
        }
        setCoachStatus(coachId, 'online');
    } catch (err) {
        console.error('Error handling image message:', err);
        addMessage(`<span class="text-danger">Unable to process image right now. Please try again later.</span>`, false);
        setCoachStatus(coachId, originalStatus);
    }
}

    // Toast utility for chat page - simplified without Bootstrap conflicts
    function showToast(message, success = false) {
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'custom-toast mb-2';
        toast.style.cssText = `
            background: linear-gradient(135deg, ${success ? 'var(--secondary)' : '#f39c12'}, ${success ? 'var(--primary)' : '#e74c3c'});
            color: white;
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            min-width: 300px;
            transform: translateX(400px);
            opacity: 0;
            transition: all 0.3s ease-in-out;
        `;
        
        const iconClass = success ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
        
        toast.innerHTML = `
            <div class="d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-2">
                    <i class="${iconClass}" style="font-size: 1.1em;"></i>
                    <div>
                        <div class="fw-semibold">${success ? 'Success' : 'Notice'}</div>
                        <div style="font-size: 0.9em; opacity: 0.9;">${message}</div>
                    </div>
                </div>
                <button type="button" class="btn-close btn-close-white ms-3" style="background: none; border: none; color: white; font-size: 1.2em; cursor: pointer; opacity: 0.7;">×</button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Manual close button
        const closeBtn = toast.querySelector('.btn-close');
        closeBtn.addEventListener('click', () => {
            hideToast(toast);
        });
        
        // Show toast with animation
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        }, 50);
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            hideToast(toast);
        }, 8000);
        
        function hideToast(toastElement) {
            toastElement.style.transform = 'translateX(400px)';
            toastElement.style.opacity = '0';
            setTimeout(() => {
                if (toastElement.parentNode) {
                    toastElement.remove();
                }
            }, 300);
        }
    }

    // Expose custom showToast globally so it overrides main.js version on this page
    try {
        window.showToast = showToast;
        console.log('Custom chat.showToast registered as window.showToast');
    } catch (e) {
        // ignore in non-browser environments
    }

    // Handle screenshot paste (Ctrl+V) for vision analysis
    messageInput.addEventListener('paste', async (event) => {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    try {
                        const resizedBlob = await resizeImage(file);
                        const base64Image = await convertToBase64(resizedBlob);
                        addMediaPreview(base64Image, 'image');
                    } catch (err) {
                        console.error('Error processing pasted image:', err);
                    }
                }
                event.preventDefault();
                break;
            }
        }
    });

    // Update file input handler to only show preview
    document.getElementById('imageUpload').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file');
                return;
            }

            try {
                const resizedBlob = await resizeImage(file);
                const base64Image = await convertToBase64(resizedBlob);
                addMediaPreview(base64Image, 'image');
            } catch (err) {
                console.error('Error processing uploaded image:', err);
            }

            event.target.value = '';
        }
    });

    // Add media preview function
    function addMediaPreview(src, type) {
        const previewContainer = document.querySelector('.media-preview-container');
        const existingPreview = previewContainer.querySelector('.media-preview');
        
        if (existingPreview) {
            existingPreview.remove();
        }

        const previewHtml = type === 'image' ? `
            <div class="media-preview d-flex align-items-center gap-2 my-2">
                <i class="bi bi-image text-primary"></i>
                <img src="data:image/jpeg;base64,${src}" class="img-fluid rounded" style="max-height: 100px;">
                <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.media-preview').remove()">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        ` : '';

        previewContainer.insertAdjacentHTML('afterbegin', previewHtml);
    }

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let audioStream = null;

    async function initializeAudioRecording() {
        try {
            audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(audioStream);
            
            mediaRecorder.ondataavailable = e => {
                audioChunks.push(e.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
                const audioUrl = URL.createObjectURL(audioBlob);
                
                // Add preview to textarea area
                const chatInput = document.querySelector('.chat-input');
                const existingPreview = chatInput.querySelector('.audio-preview');
                if (existingPreview) {
                    existingPreview.remove();
                }

                const previewHtml = `
                    <div class="audio-preview d-flex align-items-center gap-2 my-2">
                        <i class="bi bi-mic-fill text-primary"></i>
                        <audio src="${audioUrl}" controls class="audio-message flex-grow-1"></audio>
                        <button class="btn btn-sm btn-outline-danger" onclick="this.closest('.audio-preview').remove()">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `;
                
                chatInput.insertAdjacentHTML('afterbegin', previewHtml);

                // Reset recording state
                audioChunks = []; 
            };

            // Start recording immediately after getting permission
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.classList.add('text-danger');
            voiceBtn.querySelector('i').classList.replace('bi-mic-fill', 'bi-stop-fill');

        } catch (err) {
            console.error('Error accessing microphone:', err);
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.disabled = true;
            voiceBtn.title = "Microphone access denied";
        }
    }

    // Handle voice button click
    const voiceBtn = document.getElementById('voiceBtn');
    voiceBtn.addEventListener('click', async () => {
        if (!mediaRecorder) {
            // First time clicking - request permissions and initialize
            await initializeAudioRecording();
            return;
        }

        if (isRecording) {
            // Stop recording
            mediaRecorder.stop();
            isRecording = false;
            voiceBtn.classList.remove('text-danger');
            voiceBtn.querySelector('i').classList.replace('bi-stop-fill', 'bi-mic-fill');
        } else {
            // Start another recording
            audioChunks = [];
            mediaRecorder.start();
            isRecording = true;
            voiceBtn.classList.add('text-danger');
            voiceBtn.querySelector('i').classList.replace('bi-mic-fill', 'bi-stop-fill');
        }
    });

    // In your loadCoachesList or wherever you hide the coach list:
    // hideCoachListAndCenterChat();

    // Just keep the initial coach list load
    loadCoachesList();
});


