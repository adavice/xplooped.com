import { API_BASE_URL } from '/js/config.js';

// Single-flight cache: coalesce concurrent calls and cache result
let coachesCache = null;
let coachesCachePromise = null;

export async function loadCoaches() {
    // Serve from cache if we have it
    if (coachesCache) {
        return coachesCache;
    }
    // If a request is already in flight, return the same promise
    if (coachesCachePromise) {
        return coachesCachePromise;
    }

    coachesCachePromise = (async () => {
        try {
            const response = await fetch(`${API_BASE_URL}?action=list_coaches`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            if (!response.ok) {
                throw new Error(`Failed to load coaches: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            coachesCache = data;
            return coachesCache;
        } finally {
            // Clear the in-flight promise regardless of outcome
            coachesCachePromise = null;
        }
    })();

    return coachesCachePromise;
}

// Try to infer the current user id from common sources; return null if unknown
export function getCurrentUser() {
    try {
        // 1) Window-provided user object
        if (typeof window !== 'undefined' && window.currentUser && window.currentUser.id) {
            return { id: String(window.currentUser.id) };
        }

        // 2) LocalStorage fallbacks
        const lsKeys = ['currentUser', 'user'];
        for (const key of lsKeys) {
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const obj = JSON.parse(raw);
                    if (obj && obj.id) return { id: String(obj.id) };
                }
            } catch {}
        }

        // 3) Cookie fallbacks (XPLOOPED, user_id, userId, uid)
        const cookieStr = (typeof document !== 'undefined' ? document.cookie : '') || '';
        if (cookieStr) {
            const cookies = Object.fromEntries(cookieStr.split(';').map(c => {
                const [k, v] = c.split('=');
                return [decodeURIComponent(k.trim()), decodeURIComponent((v||'').trim())];
            }));

            // Prefer XPLOOPED cookie if present: format "password#login#lang" (e.g. 1234567890%23KB076%23en)
            const xp = cookies['XPLOOPED'];
            if (xp) {
                try {
                    const decoded = decodeURIComponent(xp);
                    // Structure is [password, login, lang...]. We intentionally ignore the password and only expose safe fields.
                    const [, login, ...rest] = decoded.split('#');
                    if (login) {
                        const result = { id: String(login), username: String(login) };
                        if (rest && rest.length) result.lang = rest[0];
                        return result;
                    }
                } catch {}
            }

            // Legacy cookie fallbacks (user_id, userId, uid)
            const cid = cookies['user_id'] || cookies['userId'] || cookies['uid'];
            if (cid) return { id: String(cid) };
        }
    } catch {}
    return null;
}

export async function loadChatHistory(coachId = null) {
    const user = getCurrentUser();
    // If we cannot detect user id on client, let the server use session; do not throw.
    let url = `${API_BASE_URL}?action=chat_history`;
    if (user?.id) url += `&user_id=${encodeURIComponent(user.id)}`;
    if (coachId) {
        url += `&coach_id=${encodeURIComponent(coachId)}`;
    }
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
        // Surface a clear error but avoid masking successful sessions
        const text = await response.text().catch(() => '');
        throw new Error(text || `Failed to load chat history: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('loadChatHistory response:', data);
    return data;
}

export async function deleteChatHistory(coachId) {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_chat_history',
            coach_id: coachId
        })
    });
    
    if (!response.ok) {
        throw new Error(`Failed to delete chat history: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
}

export async function deleteAllChatHistory() {
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_chat_history'
        })
    });
    
    if (!response.ok) {
        throw new Error(`Failed to delete all chat history: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
}

