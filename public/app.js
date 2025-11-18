// DOM Elements
const welcomeModal = document.getElementById('welcome-modal');
const gotItBtn = document.getElementById('got-it-btn');
const loading = document.getElementById('loading');
const stickersGrid = document.getElementById('stickers-grid');
const errorDiv = document.getElementById('error');

// Show modal on every page load
welcomeModal.classList.add('active');

// Close modal
gotItBtn.addEventListener('click', () => {
    welcomeModal.classList.remove('active');
});

// Close modal on background click
welcomeModal.addEventListener('click', (e) => {
    if (e.target === welcomeModal) {
        welcomeModal.classList.remove('active');
    }
});

// Fetch and display stickers
async function loadStickers() {
    try {
        loading.style.display = 'flex';
        
        const response = await fetch('/api/public/stickers');
        if (!response.ok) throw new Error('Failed to load stickers');
        
        const stickers = await response.json();
        
        loading.style.display = 'none';
        
        if (stickers.length === 0) {
            showError('No stickers available yet. Check back soon!');
            return;
        }
        
        displayStickers(stickers);
    } catch (error) {
        console.error('Error loading stickers:', error);
        loading.style.display = 'none';
        showError('Failed to load stickers. Please refresh the page.');
    }
}

function displayStickers(stickers) {
    stickersGrid.innerHTML = '';
    
    // Shuffle stickers for variety
    const shuffled = stickers.sort(() => Math.random() - 0.5);
    
    shuffled.forEach(sticker => {
        const card = createStickerCard(sticker);
        stickersGrid.appendChild(card);
    });
}

function createStickerCard(sticker) {
    const card = document.createElement('div');
    card.className = 'sticker-card';
    
    // Determine the correct image URL based on format type
    let imageUrl;
    let fallbackUrls = [];
    
    switch (sticker.format_type) {
        case 1: // PNG
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.png`;
            fallbackUrls = [
                `https://cdn.discordapp.com/stickers/${sticker.id}.webp`,
                `https://media.discordapp.net/stickers/${sticker.id}.png`
            ];
            break;
        case 2: // APNG (Animated PNG)
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.png`;
            fallbackUrls = [
                `https://cdn.discordapp.com/stickers/${sticker.id}.webp`,
                `https://media.discordapp.net/stickers/${sticker.id}.png`
            ];
            break;
        case 3: // LOTTIE (JSON animation - can't display, use static preview)
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.png?size=160`;
            fallbackUrls = [
                `https://media.discordapp.net/stickers/${sticker.id}.png`,
                `https://cdn.discordapp.com/stickers/${sticker.id}.webp`
            ];
            break;
        case 4: // GIF
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.gif`;
            fallbackUrls = [
                `https://cdn.discordapp.com/stickers/${sticker.id}.png`,
                `https://media.discordapp.net/stickers/${sticker.id}.gif`
            ];
            break;
        default:
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.png`;
            fallbackUrls = [
                `https://cdn.discordapp.com/stickers/${sticker.id}.webp`
            ];
    }
    
    const img = document.createElement('img');
    img.className = 'sticker-image';
    img.alt = sticker.name;
    img.loading = 'lazy';
    img.src = imageUrl;
    
    // Handle image load errors with fallbacks
    let fallbackIndex = 0;
    img.onerror = function() {
        if (fallbackIndex < fallbackUrls.length) {
            this.src = fallbackUrls[fallbackIndex];
            fallbackIndex++;
        } else {
            // All fallbacks failed, show placeholder text
            this.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'sticker-placeholder';
            placeholder.textContent = sticker.name.substring(0, 2).toUpperCase();
            card.insertBefore(placeholder, card.firstChild);
        }
    };
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'sticker-info';
    infoDiv.innerHTML = `
        <div class="sticker-name">${sticker.name}</div>
        <div class="guild-name">${sticker.guild_name}</div>
    `;
    
    card.appendChild(img);
    card.appendChild(infoDiv);
    
    // Get Discord invite link for the guild
    card.addEventListener('click', () => {
        const inviteUrl = `https://discord.gg/${sticker.invite_code}`;
        window.open(inviteUrl, '_blank');
    });
    
    return card;
}

function showError(message) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Load stickers on page load
loadStickers();
