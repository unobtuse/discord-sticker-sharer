// DOM elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const loading = document.getElementById('loading');
const welcome = document.getElementById('welcome');
const guildsContainer = document.getElementById('guilds-container');
const errorMessage = document.getElementById('error-message');
const botNotice = document.getElementById('bot-notice');
const addBotBtn = document.getElementById('add-bot-btn');

// Edit modal elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-guild-form');
const editGuildId = document.getElementById('edit-guild-id');
const editGuildName = document.getElementById('edit-guild-name');
const editGuildIcon = document.getElementById('edit-guild-icon');
const cancelEditBtn = document.getElementById('cancel-edit');

// Event listeners
loginBtn.addEventListener('click', () => {
    window.location.href = '/login';
});

logoutBtn.addEventListener('click', () => {
    window.location.href = '/logout';
});

addBotBtn.addEventListener('click', async () => {
    const response = await fetch('/api/bot-invite-url');
    const data = await response.json();
    window.open(data.inviteUrl, '_blank');
});

cancelEditBtn.addEventListener('click', () => {
    closeEditModal();
});

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveGuildChanges();
});

// Close modal when clicking outside
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
        closeEditModal();
    }
});

// Check authentication status on load
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        if (data.authenticated) {
            await loadUserData();
        } else {
            showWelcome();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showWelcome();
    }
}

function showWelcome() {
    loginBtn.style.display = 'block';
    userInfo.style.display = 'none';
    welcome.style.display = 'block';
    loading.style.display = 'none';
    guildsContainer.innerHTML = '';
    botNotice.style.display = 'none';
}

function showLoading() {
    welcome.style.display = 'none';
    loading.style.display = 'block';
    guildsContainer.innerHTML = '';
    errorMessage.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loading.style.display = 'none';
}

async function loadUserData() {
    try {
        const userResponse = await fetch('/api/user');
        if (!userResponse.ok) throw new Error('Failed to fetch user');
        
        const user = await userResponse.json();
        
        // Update UI with user info
        const avatarUrl = user.avatar 
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
        
        userAvatar.src = avatarUrl;
        userName.textContent = user.username;
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        
        await loadGuilds();
    } catch (error) {
        console.error('Failed to load user data:', error);
        showError('Failed to load user data. Please try logging in again.');
    }
}

async function loadGuilds() {
    showLoading();
    
    try {
        const response = await fetch('/api/guilds');
        if (!response.ok) throw new Error('Failed to fetch guilds');
        
        const guilds = await response.json();
        loading.style.display = 'none';
        
        if (guilds.length === 0) {
            guildsContainer.innerHTML = '<div class="no-stickers">You don\'t own any Discord servers yet.</div>';
            return;
        }
        
        // Check if bot is in any servers
        const botInAnyServer = guilds.some(g => g.bot_in_guild || (g.stickers && g.stickers.length > 0));
        if (!botInAnyServer) {
            botNotice.style.display = 'block';
        } else {
            botNotice.style.display = 'none';
        }
        
        displayGuilds(guilds);
    } catch (error) {
        console.error('Failed to load guilds:', error);
        showError('Failed to load your servers. Please try again later.');
    }
}

function displayGuilds(guilds) {
    guildsContainer.innerHTML = '';
    
    guilds.forEach(guild => {
        const guildCard = createGuildCard(guild);
        guildsContainer.appendChild(guildCard);
    });
    
    // Add event listeners for guild-specific bot add buttons
    document.querySelectorAll('.btn-add-to-guild').forEach(btn => {
        btn.addEventListener('click', async () => {
            const guildId = btn.dataset.guildId;
            const response = await fetch('/api/bot-invite-url');
            const data = await response.json();
            window.open(`${data.inviteUrl}&guild_id=${guildId}`, '_blank');
        });
    });

    // Add event listeners for create invite buttons
    document.querySelectorAll('.btn-create-invite').forEach(btn => {
        btn.addEventListener('click', async () => {
            const guildId = btn.dataset.guildId;
            btn.disabled = true;
            btn.textContent = 'Creating...';
            
            try {
                const response = await fetch(`/api/guilds/${guildId}/create-invite`, {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.success) {
                    // Update the button to show success
                    btn.textContent = '✓ Created';
                    btn.classList.add('btn-success');
                    
                    // Add invite code display
                    const inviteDisplay = document.createElement('div');
                    inviteDisplay.className = 'invite-created';
                    inviteDisplay.innerHTML = `
                        <strong>Invite Code:</strong> 
                        <a href="https://discord.gg/${data.invite_code}" target="_blank">
                            discord.gg/${data.invite_code}
                        </a>
                    `;
                    btn.parentElement.appendChild(inviteDisplay);
                } else {
                    throw new Error(data.error || 'Failed to create invite');
                }
            } catch (error) {
                btn.textContent = '✗ Failed - Try Again';
                btn.disabled = false;
                alert(error.message || 'Failed to create invite. You may be rate limited. Wait a minute and try again.');
            }
        });
    });

    // Add event listeners for edit guild buttons
    document.querySelectorAll('.btn-edit-guild').forEach(btn => {
        btn.addEventListener('click', () => {
            const guildId = btn.dataset.guildId;
            const guildName = btn.dataset.guildName;
            openEditModal(guildId, guildName);
        });
    });

    // Add event listeners for upgrade bot permissions buttons
    document.querySelectorAll('.btn-upgrade-bot').forEach(btn => {
        btn.addEventListener('click', async () => {
            const guildId = btn.dataset.guildId;
            const response = await fetch(`/api/bot-admin-url/${guildId}`);
            const data = await response.json();
            
            const confirmed = confirm(
                `This will open Discord to grant the bot Administrator permissions.\n\n` +
                `This is needed to:\n` +
                `• Edit server name\n` +
                `• Edit server icon\n` +
                `• Create invite links\n\n` +
                `Click OK to continue to Discord.`
            );
            
            if (confirmed) {
                window.open(data.inviteUrl, '_blank');
            }
        });
    });
}

function openEditModal(guildId, guildName) {
    editGuildId.value = guildId;
    editGuildName.value = guildName;
    editGuildIcon.value = '';
    editModal.style.display = 'flex';
}

function closeEditModal() {
    editModal.style.display = 'none';
    editForm.reset();
}

async function saveGuildChanges() {
    const guildId = editGuildId.value;
    const name = editGuildName.value.trim();
    const iconFile = editGuildIcon.files[0];

    if (!name && !iconFile) {
        alert('Please provide a new name or icon');
        return;
    }

    const formData = new FormData();
    if (name) {
        formData.append('name', name);
    }
    if (iconFile) {
        formData.append('icon', iconFile);
    }

    try {
        const submitBtn = editForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        const response = await fetch(`/api/guilds/${guildId}`, {
            method: 'PATCH',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            alert('Server updated successfully!');
            closeEditModal();
            // Reload guilds to show updated info
            await loadGuilds();
        } else {
            throw new Error(data.error || 'Failed to update server');
        }
    } catch (error) {
        const errorMsg = error.message || 'Failed to update server';
        
        if (errorMsg.includes('Missing Permissions') || errorMsg.includes('50013')) {
            alert(
                'Missing Permissions!\n\n' +
                'The bot needs Administrator permissions to edit server settings.\n\n' +
                'Click the "🔑 Make Bot Admin" button on this server card to grant permissions.'
            );
        } else {
            alert(errorMsg);
        }
        
        const submitBtn = editForm.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
}

function createGuildCard(guild) {
    const card = document.createElement('div');
    card.className = 'guild-card';
    
    const iconUrl = guild.icon 
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
        : null;
    
    const iconHtml = iconUrl 
        ? `<img src="${iconUrl}" alt="${guild.name}">`
        : guild.name.charAt(0).toUpperCase();
    
    const memberCount = guild.approximate_member_count 
        ? `<span class="member-count">👥 ${guild.approximate_member_count.toLocaleString()} members</span>`
        : '';
    
    // Invite management section
    let inviteSection = '';
    if (guild.vanity_url_code) {
        inviteSection = `
            <div class="invite-section">
                <strong>Vanity URL:</strong> 
                <a href="https://discord.gg/${guild.vanity_url_code}" target="_blank" class="invite-link">
                    discord.gg/${guild.vanity_url_code}
                </a>
            </div>
        `;
    } else if (guild.stored_invite) {
        inviteSection = `
            <div class="invite-section">
                <strong>Permanent Invite:</strong> 
                <a href="https://discord.gg/${guild.stored_invite}" target="_blank" class="invite-link">
                    discord.gg/${guild.stored_invite}
                </a>
            </div>
        `;
    } else {
        inviteSection = `
            <div class="invite-section">
                <p>📎 No permanent invite found</p>
                <button class="btn btn-create-invite" data-guild-id="${guild.id}">Create Permanent Invite</button>
            </div>
        `;
    }
    
    // Bot admin button
    const botAdminButton = guild.bot_is_admin
        ? `<button class="btn btn-admin-status" disabled title="Bot has administrator permissions">
            ✅ Bot Is Admin
           </button>`
        : `<button class="btn btn-upgrade btn-upgrade-bot" data-guild-id="${guild.id}" title="Grant bot admin permissions">
            🔑 Make Bot Admin
           </button>`;
    
    // Create card structure
    const headerDiv = document.createElement('div');
    headerDiv.className = 'guild-header';
    headerDiv.innerHTML = `
        <div class="guild-icon">${iconHtml}</div>
        <div class="guild-info">
            <h2>${guild.name}</h2>
            <div class="guild-meta">
                ${memberCount}
                <div class="guild-actions">
                    <button class="btn btn-edit btn-edit-guild" data-guild-id="${guild.id}" data-guild-name="${guild.name}">
                        ✏️ Edit Server
                    </button>
                    ${botAdminButton}
                </div>
            </div>
        </div>
    `;
    
    const inviteDiv = document.createElement('div');
    inviteDiv.innerHTML = inviteSection;
    
    card.appendChild(headerDiv);
    card.appendChild(inviteDiv);
    
    // Add stickers section with proper fallback handling
    if (guild.stickers && guild.stickers.length > 0) {
        const stickersSection = document.createElement('div');
        stickersSection.className = 'stickers-section';
        
        const stickersTitle = document.createElement('h3');
        stickersTitle.textContent = `🎨 Stickers (${guild.stickers.length})`;
        stickersSection.appendChild(stickersTitle);
        
        const stickersGrid = document.createElement('div');
        stickersGrid.className = 'stickers-grid';
        
        guild.stickers.forEach(sticker => {
            const stickerItem = createStickerItem(sticker);
            stickersGrid.appendChild(stickerItem);
        });
        
        stickersSection.appendChild(stickersGrid);
        card.appendChild(stickersSection);
    } else {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'guild-warning';
        warningDiv.innerHTML = `
            <p>⚠️ Bot not installed in this server. Add the bot to view stickers.</p>
            <button class="btn btn-add-to-guild" data-guild-id="${guild.id}">Add Bot Here</button>
        `;
        card.appendChild(warningDiv);
    }
    
    return card;
}

function createStickerItem(sticker) {
    const item = document.createElement('div');
    item.className = 'sticker-item';
    
    // Determine URLs based on format type
    let imageUrl;
    let fallbackUrls = [];
    
    switch (sticker.format_type) {
        case 1: // PNG
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.png?size=160`;
            fallbackUrls = [
                `https://cdn.discordapp.com/stickers/${sticker.id}.webp?size=160`,
                `https://media.discordapp.net/stickers/${sticker.id}.png`
            ];
            break;
        case 2: // APNG
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.png?size=160`;
            fallbackUrls = [
                `https://cdn.discordapp.com/stickers/${sticker.id}.webp?size=160`,
                `https://media.discordapp.net/stickers/${sticker.id}.png`
            ];
            break;
        case 3: // LOTTIE
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.png?size=160`;
            fallbackUrls = [
                `https://media.discordapp.net/stickers/${sticker.id}.png`,
                `https://cdn.discordapp.com/stickers/${sticker.id}.webp?size=160`
            ];
            break;
        case 4: // GIF
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.gif`;
            fallbackUrls = [
                `https://cdn.discordapp.com/stickers/${sticker.id}.png?size=160`,
                `https://media.discordapp.net/stickers/${sticker.id}.gif`
            ];
            break;
        default:
            imageUrl = `https://cdn.discordapp.com/stickers/${sticker.id}.png?size=160`;
            fallbackUrls = [
                `https://cdn.discordapp.com/stickers/${sticker.id}.webp?size=160`
            ];
    }
    
    const img = document.createElement('img');
    img.className = 'sticker-image';
    img.alt = sticker.name;
    img.src = imageUrl;
    
    // Handle errors with fallbacks
    let fallbackIndex = 0;
    img.onerror = function() {
        if (fallbackIndex < fallbackUrls.length) {
            this.src = fallbackUrls[fallbackIndex];
            fallbackIndex++;
        } else {
            // Show placeholder
            this.style.display = 'none';
            const placeholder = document.createElement('div');
            placeholder.className = 'sticker-placeholder';
            placeholder.textContent = sticker.name.substring(0, 2).toUpperCase();
            item.insertBefore(placeholder, item.firstChild);
        }
    };
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'sticker-name';
    nameDiv.textContent = sticker.name;
    
    item.appendChild(img);
    item.appendChild(nameDiv);
    
    return item;
}

// Initialize on page load
checkAuth();

// Check for errors in URL
const urlParams = new URLSearchParams(window.location.search);
const errorParam = urlParams.get('error');
if (errorParam) {
    if (errorParam === 'unauthorized') {
        showError('Access Denied: You are not authorized to access this admin panel. Only the server owner can access this page.');
    } else {
        showError('Authentication failed. Please try again.');
    }
}
