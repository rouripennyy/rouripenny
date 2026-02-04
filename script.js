
const API_ENDPOINT = 'https://api.a4f.co/v1/images/generations';
const PROMPT_INPUT = document.getElementById('promptInput');
const GENERATE_BTN = document.getElementById('generateBtn');
const GALLERY = document.getElementById('gallery');
const LOADING_STATE = document.getElementById('loadingState');
const EMPTY_STATE = document.getElementById('emptyState');
const MODEL_BTN = document.getElementById('modelBtn');

let currentModel = 'v1';
const models = {
    v1: { name: 'motion-blur-v1', api: 'provider-4/imagen-3.5' },
    v2: { name: 'motion-blur-v2', api: 'provider-4/imagen-4' }
};

// Helper: Get API Key
function getApiKey() {
    return 'ddc-a4f-acd25530723047edb46f5d07c3fd60c8';
}

// Helper: Generate Image
async function generateImage(prompt) {
    const apiKey = getApiKey();
    if (!apiKey) return;

    // UI Updates
    setLoading(true);
    
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "model": models[currentModel].api,
                "prompt": prompt,
                "n": 1,
                "size": "1024x1024"
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error: ${errText}`);
        }

        const data = await response.json();
        const imageUrl = data.data?.[0]?.url;

        if (imageUrl) {
            addImageToGallery(imageUrl, prompt);
            PROMPT_INPUT.value = ''; // Clear input on success
        } else {
            throw new Error("No image URL returned");
        }

    } catch (error) {
        console.error(error);
        alert("Failed to generate image. Please try again.");
    } finally {
        setLoading(false);
    }
}

// Helper: UI State
function setLoading(isLoading) {
    if (isLoading) {
        GENERATE_BTN.disabled = true;
        GENERATE_BTN.innerHTML = '<div class="spinner"></div>';
        LOADING_STATE.classList.remove('hidden');
        if (EMPTY_STATE) EMPTY_STATE.classList.add('hidden');
    } else {
        GENERATE_BTN.disabled = false;
        GENERATE_BTN.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z"/>
                <path d="M22 2 11 13"/>
            </svg>
        `;
        LOADING_STATE.classList.add('hidden');
    }
}

// IndexedDB helpers
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AuraImages', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('images')) {
                db.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

async function saveImageToDB(url, prompt) {
    const response = await fetch(url);
    const blob = await response.blob();
    const localUrl = URL.createObjectURL(blob);
    const db = await openDB();
    const tx = db.transaction(['images'], 'readwrite');
    const store = tx.objectStore('images');
    return new Promise((resolve, reject) => {
        const request = store.add({ blob, prompt, timestamp: Date.now(), localUrl });
        request.onsuccess = () => resolve({ id: request.result, localUrl });
        request.onerror = () => reject(request.error);
    });
}

function downloadFromDB(id, filename) {
    openDB().then(db => {
        const tx = db.transaction(['images'], 'readonly');
        const store = tx.objectStore('images');
        const request = store.get(id);
        request.onsuccess = () => {
            const { blob } = request.result;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        };
    });
}

// Helper: Add to Gallery
async function addImageToGallery(url, prompt) {
    if (EMPTY_STATE) EMPTY_STATE.classList.add('hidden');

    const { id: imageId, localUrl } = await saveImageToDB(url, prompt);

    const card = document.createElement('div');
    card.className = 'group relative aspect-square bg-[#18181b] rounded-xl overflow-hidden border border-white/5 animate-fade-in';
    
    card.innerHTML = `
        <img src="${localUrl}" alt="${prompt}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <p class="text-white text-xs font-medium line-clamp-2 mb-3">${prompt}</p>
            <button onclick="downloadFromDB(${imageId}, 'image-${imageId}.png')" class="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-gray-200 transition-colors">
                Download
            </button>
        </div>
    `;

    GALLERY.insertBefore(card, GALLERY.firstChild);
}

// Load saved images on page load
async function loadSavedImages() {
    try {
        const db = await openDB();
        const tx = db.transaction(['images'], 'readonly');
        const store = tx.objectStore('images');
        const request = store.getAll();
        request.onsuccess = () => {
            const images = request.result.reverse();
            images.forEach(({ id, blob, prompt }) => {
                const localUrl = URL.createObjectURL(blob);
                const card = document.createElement('div');
                card.className = 'group relative aspect-square bg-[#18181b] rounded-xl overflow-hidden border border-white/5 animate-fade-in';
                card.innerHTML = `
                    <img src="${localUrl}" alt="${prompt}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <p class="text-white text-xs font-medium line-clamp-2 mb-3">${prompt}</p>
                        <button onclick="downloadFromDB(${id}, 'image-${id}.png')" class="inline-flex items-center gap-2 px-3 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-gray-200 transition-colors">
                            Download
                        </button>
                    </div>
                `;
                GALLERY.appendChild(card);
            });
            if (images.length > 0 && EMPTY_STATE) EMPTY_STATE.classList.add('hidden');
        };
    } catch (error) {
        console.error('Failed to load saved images:', error);
    }
}

// Load images when page loads
window.addEventListener('load', loadSavedImages);

function toggleModel() {
    currentModel = currentModel === 'v1' ? 'v2' : 'v1';
    MODEL_BTN.textContent = models[currentModel].name;
}

// Event Listeners
MODEL_BTN.addEventListener('click', toggleModel);
GENERATE_BTN.addEventListener('click', () => {
    const prompt = PROMPT_INPUT.value.trim();
    if (prompt) generateImage(prompt);
});

PROMPT_INPUT.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const prompt = PROMPT_INPUT.value.trim();
        if (prompt) generateImage(prompt);
    }
});
