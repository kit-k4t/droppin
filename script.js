// ============================================
// DropPin - Supabase Edition
// ============================================

const SUPABASE_URL = 'https://mzhbxzlzrohtpuxmfofa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16aGJ4emx6cm9odHB1eG1mb2ZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzQ3ODAsImV4cCI6MjA5NTQ1MDc4MH0.d6iREHNC9IlECcO3zoIDW8y0LfprKmwSAdgmejKA9O0';
const PUBLIC_GROUP_ID = '00000000-0000-0000-0000-000000000001';

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let CURRENT_USER_ID = localStorage.getItem('droppin_user_id');
if (!CURRENT_USER_ID) {
    CURRENT_USER_ID = crypto.randomUUID();
    localStorage.setItem('droppin_user_id', CURRENT_USER_ID);
}

let GROUP = null;
let map;
let IS_DROP_MODE = false;
let tempMarker = null;
let pinLifespanDays = 30;
let HAS_AGREED = localStorage.getItem('droppin_agreed') === 'true';

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        
        const urlParams = new URLSearchParams(location.search);
        const groupFromUrl = urlParams.get('group');
        
        if (groupFromUrl === PUBLIC_GROUP_ID) {
            GROUP = groupFromUrl;
            showMapScreen();
        } else {
            showWelcomeScreen();
        }
    }, 2200);
});

// ============================================
// SCREEN MANAGEMENT
// ============================================

function showWelcomeScreen() {
    document.getElementById('welcome-screen').classList.add('active');
    document.getElementById('map-screen').classList.remove('active');
    document.body.classList.add('welcome-active');

}

function showMapScreen() {
    document.getElementById('welcome-screen').classList.remove('active');
    document.body.classList.remove('welcome-active');
    document.getElementById('map-screen').classList.add('active');
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            if (!map) {
                initMap();
                setTimeout(() => {
                    map.invalidateSize();
                    loadPins();
                }, 300);
            } else {
                map.invalidateSize();
                loadPins();
            }
        }, 100);
    });
}

function goToWelcome() {
    playSound('cancel');
    GROUP = null;
    window.history.replaceState({}, '', window.location.pathname);
    IS_DROP_MODE = false;
    document.getElementById('drop-btn').classList.remove('drop-active');
    showWelcomeScreen();
}

// ============================================
// TERMS & PRIVACY
// ============================================

function toggleAgree() {
    const checked = document.getElementById('agree-check').checked;
    const agreeBtn = document.getElementById('agree-btn');
    
    if (checked) {
        playSound('click');
        HAS_AGREED = true;
        localStorage.setItem('droppin_agreed', 'true');
        agreeBtn.classList.remove('btn-disabled');
    } else {
        playSound('cancel');
        HAS_AGREED = false;
        localStorage.removeItem('droppin_agreed');
        agreeBtn.classList.add('btn-disabled');
    }
}

function handleAgreeClick() {
    const checked = document.getElementById('agree-check').checked;
    if (!checked) {
        playSound('bloop');
        showToast('Please read and agree to our Terms of Service and Privacy Policy first');
        return;
    }
    playSound('click');
    hideInfo();
}

function hideInfo() {
    HAS_AGREED = true;
    localStorage.setItem('droppin_agreed', 'true');
    document.getElementById('info-screen').classList.remove('active');
    showWelcomeScreen();
}

function showInfo() {
    playSound('click');
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('info-screen').classList.add('active');
    document.getElementById('user-id-display').textContent = CURRENT_USER_ID || 'Not available';

    const agreeCheck = document.getElementById('agree-check');
    const agreeBtn = document.getElementById('agree-btn');
    
    if (HAS_AGREED) {
        agreeCheck.checked = true;
        agreeBtn.classList.remove('btn-disabled');
    } else {
        agreeCheck.checked = false;
        agreeBtn.classList.add('btn-disabled');
    }
}

// ============================================
// GROUP MANAGEMENT
// ============================================

async function joinPublicGroup() {
    playSound('click');
    if (!HAS_AGREED) {
        showInfo();
        playSound('bloop');
        showToast('Please read and agree to our Terms of Service and Privacy Policy first');
        return;
    }
    
    try {
        await ensureUserExists();

        GROUP = PUBLIC_GROUP_ID;
        window.history.replaceState({}, '', `?group=${GROUP}`);
        showMapScreen();
        playSound('success');
        showToast('🌍 Welcome to the public map!');
    } catch (err) {
        console.error('Failed to join public group:', err);
        showToast('❌ Failed to load public map');
        playSound('error'); 
    }
}

async function ensureUserExists() {
    const { data, error } = await supabaseClient
        .from('users')
        .select('id')
        .eq('id', CURRENT_USER_ID)
        .single();

    if (error && error.code === 'PGRST116') {
        const { error: insertError } = await supabaseClient
            .from('users')
            .insert([{ id: CURRENT_USER_ID }]);

        if (insertError) throw insertError;
    } else if (error) {
        throw error;
    }
}

function showComingSoon() {
    playSound('bloop');
    showToast('🔒 Private groups coming soon!');
}

// ============================================
// MAP
// ============================================

function initMap() {
    map = L.map('map', {
        center: [14.5995, 120.9842],
        zoom: 13,
        worldCopyJump: true
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                map.flyTo([pos.coords.latitude, pos.coords.longitude], 13, {
                    animate: true,
                    duration: 1.5
                });
            },
            (err) => {
                if (err.code === err.PERMISSION_DENIED) {
                    playSound('error');
                    showToast('Enable location permission in browser settings to automatically detect current location in map');
                } else {
                    playSound('error');
                    showToast('📍 Unable to detect location. Using default.');
                }
            },
            { timeout: 10000, maximumAge: 60000 } 
        );
    }
    
    map.on('click', (e) => {
        if (!IS_DROP_MODE) return;
        playSound('click');
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = L.marker(e.latlng).addTo(map);
        openDropModal();
        IS_DROP_MODE = false;
        document.getElementById('drop-btn').classList.remove('drop-active');
    });

    map.on('popupopen', () => {
        playSound('pop');
    });

    map.on('popupclose', () => {
        playSound('bloop');
    });
    
    setTimeout(() => map.invalidateSize(), 100);
}

function toggleDropMode() {
    IS_DROP_MODE = !IS_DROP_MODE;
    const btn = document.getElementById('drop-btn');
    
    if (IS_DROP_MODE) {
        btn.classList.add('drop-active');
        playSound('click');
        showToast('Tap anywhere on the map to drop a pin 📍');
    } else {
        btn.classList.remove('drop-active');
        playSound('cancel');
    }
}

// ============================================
// MODALS
// ============================================

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

function openDropModal() {
    closeAllModals();
    document.getElementById('drop-modal').classList.add('active');
}

function cancelDrop() {
    closeAllModals();
    playSound('cancel');

    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    
    IS_DROP_MODE = false;
    document.getElementById('drop-btn').classList.remove('drop-active');
}

function showComingSoonMedia(type) {
    playSound('bloop');
    const labels = {
        photo: '📸 Photo support coming soon!',
        audio: '🎙️ Audio support coming soon!',
    };
    showToast(labels[type] || 'Coming soon!');
}

function setLifespan(days) {
    playSound('click');
    pinLifespanDays = days;
    document.querySelectorAll('.lifespan-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.days) === days) {
            btn.classList.add('active');
        }
    });
}

// ============================================
// PIN OPERATIONS (SUPABASE)
// ============================================

async function submitPin() {
    const text = document.getElementById('pin-text').value.trim();
    if (!text) {
        playSound('error');
        showToast('Add a note before dropping your pin.');
        return;
    }

    const latlng = tempMarker.getLatLng();

    const now = new Date();
    expiresAt = new Date(now.getTime() + pinLifespanDays * 24 * 60 * 60 * 1000).toISOString();
    
    const pinData = {
        group_id: GROUP,
        user_id: CURRENT_USER_ID,
        lat: latlng.lat,
        lng: latlng.lng,
        text: text,
        lifespan_days: pinLifespanDays,
        expires_at: expiresAt
    };

    try {
        const { data, error } = await supabaseClient
            .from('pins')
            .insert([pinData])
            .select()
            .single();

        if (error) throw error;

        playSound('drop');
        showToast('📍 Pin dropped!');
        closeAllModals();

        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }

        await loadPins();
        
    } catch (err) {
        console.error('Failed to drop pin:', err);
        playSound('error');
        showToast('❌ Failed to drop pin');
    }

    document.getElementById('pin-text').value = '';
    setLifespan(30);
}

async function loadPins() {
    if (!map || !GROUP) return;
    
    map.eachLayer(layer => {
        if (layer instanceof L.Marker && layer !== tempMarker) {
            map.removeLayer(layer);
        }
    });
    
    try {
        const { data: pins, error } = await supabaseClient
            .from('pins')
            .select(`
                *,
                reactions:reactions(emoji, user_id)
            `)
            .eq('group_id', GROUP)
            .or('expires_at.is.null,expires_at.gt.now');

        if (error) throw error;

        pins.forEach(pin => {
            addPinToMap(pin);
        });

        window._lastLoadedPins = pins;
        
    } catch (err) {
        console.error('Failed to load pins:', err);
        playSound('error');
        showToast('❌ Failed to load pins');
    }
}

function buildPinPopup(pin) {
    const userColor = stringToColor(pin.user_id);
    const isOurPin = CURRENT_USER_ID && pin.user_id === CURRENT_USER_ID;
    const pinTime = new Date(pin.created_at);
    const lifespanText = `${pin.lifespan_days} day/s`;
    
    const emojis = ['🔥', '❤️', '😂', '💀'];
    const counts = {};
    emojis.forEach(e => counts[e] = 0);

    const freshPin = window._lastLoadedPins?.find(p => p.id === pin.id);
    const reactions = freshPin?.reactions || pin.reactions;
    
    if (reactions) {
        reactions.forEach(r => {
            if (counts[r.emoji] !== undefined) {
                counts[r.emoji]++;
            }
        });
    }

    let reactedEmojis = JSON.parse(localStorage.getItem(`reactions_${pin.id}`) || '[]');
    
    if (reactions) {
        const myReactions = reactions.filter(r => r.user_id === CURRENT_USER_ID).map(r => r.emoji);
        myReactions.forEach(emoji => {
            if (!reactedEmojis.includes(emoji)) {
                reactedEmojis.push(emoji);
            }
        });
        localStorage.setItem(`reactions_${pin.id}`, JSON.stringify(reactedEmojis));
    }
    
    const reactionsHtml = emojis.map(emoji => {
        const alreadyReacted = reactedEmojis.includes(emoji);
        const reactedClass = alreadyReacted ? 'reacted' : '';
        return `<button class="react-btn ${reactedClass}" onclick="react(this, '${pin.id}', '${emoji}')">${emoji} <span class="count">${counts[emoji]}</span></button>`;
    }).join('');
    
    return `
        <div class="pin-popup">
            <div class="author">
                <div class="author-dot ${isOurPin ? 'you' : ''}" style="background:${userColor};"></div>
                <div class="author-name ${isOurPin ? 'you' : ''}">${isOurPin ? 'You' : 'Anonymous'}</div>
                <div class="time">${timeAgo(pinTime)}</div>
            </div>
            ${pin.text ? `<div class="text">${escapeHtml(pin.text)}</div>` : ''}
            <div class="reactions">
                ${reactionsHtml}
            </div>
            <div class="expires">⏰ Expires in ${lifespanText}</div>
        </div>
    `;
}

function addPinToMap(pin) {
    const marker = L.marker([parseFloat(pin.lat), parseFloat(pin.lng)], {
        worldCopyJump: true
    }).addTo(map);
    
    const popup = buildPinPopup(pin);
    marker.bindPopup(popup);
    marker._pinId = pin.id;

    marker.on('popupopen', () => {
        const freshPopup = buildPinPopup(pin);
        marker.setPopupContent(freshPopup);
    });
}

// ============================================
// REACTIONS
// ============================================

async function react(btn, pinId, emoji) {
    const storageKey = `reactions_${pinId}`;
    const reacted = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    if (reacted.includes(emoji)) {
        playSound('bloop');
        showToast('You already reacted!');
        return;
    }
    
    const count = btn.querySelector('.count');
    count.textContent = parseInt(count.textContent) + 1;
    btn.classList.add('reacted');
    
    reacted.push(emoji);
    localStorage.setItem(storageKey, JSON.stringify(reacted));
    playSound('react');
    
    try {
        const { error } = await supabaseClient
            .from('reactions')
            .insert([{
                pin_id: pinId,
                user_id: CURRENT_USER_ID,
                emoji: emoji
            }]);

        if (error) {
            if (error.code !== '23505') throw error;
        }
    } catch (err) {
        console.error('Failed to save reaction:', err);
        count.textContent = parseInt(count.textContent) - 1;
        btn.classList.remove('reacted');

        const idx = reacted.indexOf(emoji);
        if (idx > -1) reacted.splice(idx, 1);
        localStorage.setItem(storageKey, JSON.stringify(reacted));
    }
}

// ============================================
// UTILITIES
// ============================================

function timeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'),1500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function playSound(type) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'drop') {
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'react') {
        oscillator.frequency.value = 600;
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } else if (type === 'success') {
        oscillator.frequency.value = 1000;
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'cancel') {
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'error') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 150;
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'click') {
        oscillator.frequency.value = 1200;
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'pop') {
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'bloop') {
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.07, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    }
}