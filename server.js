require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');

// Configure multer for file uploads (in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

// Discord API configuration
const DISCORD_API = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;

// Generate session secret if not provided
let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.log('⚠️  No SESSION_SECRET found in .env, generated temporary secret.');
  console.log('   Add this to your .env file to persist sessions across restarts:');
  console.log(`   SESSION_SECRET=${SESSION_SECRET}`);
}

// Configuration file paths
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');
const INVITES_FILE = path.join(__dirname, 'data', 'invites.json');

// Ensure data directory exists
if (!fsSync.existsSync(path.join(__dirname, 'data'))) {
  fsSync.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Load or initialize configuration
let config = {
  setupComplete: false,
  adminUserId: null
};

if (fsSync.existsSync(CONFIG_FILE)) {
  try {
    config = JSON.parse(fsSync.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

function saveConfig() {
  try {
    fsSync.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Cache for public stickers
let publicStickersCache = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for bot admin status per guild
const botAdminCache = new Map();
const BOT_ADMIN_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Helper functions for invite storage
async function loadInvites() {
  try {
    const data = await fs.readFile(INVITES_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

async function saveInvite(guildId, inviteCode) {
  try {
    const invites = await loadInvites();
    invites[guildId] = {
      code: inviteCode,
      created_at: new Date().toISOString()
    };
    await fs.writeFile(INVITES_FILE, JSON.stringify(invites, null, 2));
  } catch (error) {
    console.error('Error saving invite:', error);
  }
}

async function getStoredInvite(guildId) {
  const invites = await loadInvites();
  return invites[guildId]?.code || null;
}

// Middleware to check if setup is complete
function requireSetup(req, res, next) {
  if (!config.setupComplete) {
    return res.redirect('/setup');
  }
  next();
}

// Middleware to check if user is authorized admin
function requireAdmin(req, res, next) {
  if (!req.session.accessToken || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (req.session.userId !== config.adminUserId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  next();
}

// Setup routes
app.get('/setup', (req, res) => {
  // If already set up, redirect to admin
  if (config.setupComplete) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'setup', 'setup.html'));
});

app.get('/api/setup/check', (req, res) => {
  const missing = [];
  
  if (!process.env.DISCORD_BOT_TOKEN) missing.push('DISCORD_BOT_TOKEN');
  if (!process.env.DISCORD_CLIENT_ID) missing.push('DISCORD_CLIENT_ID');
  if (!process.env.DISCORD_CLIENT_SECRET) missing.push('DISCORD_CLIENT_SECRET');
  
  res.json({
    configured: missing.length === 0,
    missing: missing,
    setupComplete: config.setupComplete
  });
});

// OAuth routes
app.get('/auth/discord', (req, res) => {
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/setup?error=no_code');
  }

  try {
    // Exchange code for token
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', 
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const user = userResponse.data;

    // Store in session
    req.session.accessToken = access_token;
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.avatar = user.avatar;

    // If this is first-time setup, set as admin
    if (!config.setupComplete) {
      config.adminUserId = user.id;
      config.setupComplete = true;
      saveConfig();
      console.log(`✓ Setup complete! Admin set to: ${user.username} (${user.id})`);
      return res.redirect('/setup?success=true');
    }

    // Otherwise, redirect to admin
    res.redirect('/admin');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.redirect('/setup?error=auth_failed');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Public API endpoint - get all stickers from all guilds
app.get('/api/public/stickers', async (req, res) => {
  // Return cached data if still valid
  if (publicStickersCache && (Date.now() - lastCacheUpdate) < CACHE_DURATION) {
    return res.json(publicStickersCache);
  }

  try {
    // Fetch guild data using bot token
    if (!process.env.DISCORD_BOT_TOKEN) {
      return res.status(500).json({ error: 'Bot token not configured' });
    }

    // Get bot's guilds
    const botGuildsResponse = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
    });

    // Fetch stickers and invites for each guild
    const allStickers = [];
    await Promise.all(
      botGuildsResponse.data.map(async (guild) => {
        try {
          // Fetch stickers
          const stickersResponse = await axios.get(
            `${DISCORD_API}/guilds/${guild.id}/stickers`,
            {
              headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
            }
          );
          
          // Try to get invite code (check stored, vanity URL, or existing invites)
          let inviteCode = null;
          
          // First, check stored invites
          inviteCode = await getStoredInvite(guild.id);
          
          if (!inviteCode) {
            try {
              // Check for vanity URL
              const vanityResponse = await axios.get(
                `${DISCORD_API}/guilds/${guild.id}/vanity-url`,
                {
                  headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
                }
              );
              if (vanityResponse.data.code) {
                inviteCode = vanityResponse.data.code;
                await saveInvite(guild.id, inviteCode); // Store it
              }
            } catch (vanityError) {
              // No vanity URL, try to get existing invites
              try {
                const invitesResponse = await axios.get(
                  `${DISCORD_API}/guilds/${guild.id}/invites`,
                  {
                    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
                  }
                );
                if (invitesResponse.data.length > 0) {
                  // Find a permanent invite or use the first one
                  const permanentInvite = invitesResponse.data.find(inv => inv.max_age === 0);
                  inviteCode = permanentInvite ? permanentInvite.code : invitesResponse.data[0].code;
                  await saveInvite(guild.id, inviteCode); // Store it
                }
              } catch (inviteError) {
                // Can't get invites - will need to create manually
              }
            }
          }
          
          stickersResponse.data.forEach(sticker => {
            allStickers.push({
              id: sticker.id,
              name: sticker.name,
              description: sticker.description,
              guild_id: guild.id,
              guild_name: guild.name,
              guild_icon: guild.icon,
              format_type: sticker.format_type,
              invite_code: inviteCode || guild.id
            });
          });
        } catch (error) {
          console.error(`Failed to fetch stickers for guild ${guild.id}:`, error.message);
        }
      })
    );

    // Shuffle stickers for variety
    allStickers.sort(() => Math.random() - 0.5);

    // Cache the result
    publicStickersCache = allStickers;
    lastCacheUpdate = Date.now();

    res.json(allStickers);
  } catch (error) {
    console.error('Public stickers fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch stickers' });
  }
});

// Admin API routes
app.get('/api/guilds', requireSetup, requireAdmin, async (req, res) => {
  try {
    // Fetch user's guilds
    const guildsResponse = await axios.get(`${DISCORD_API}/users/@me/guilds`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });

    // Filter guilds where user is owner
    const ownedGuilds = guildsResponse.data.filter(guild => guild.owner);
    
    // Load stored invites
    const storedInvites = await loadInvites();

    // Try to fetch stickers using bot token (only works if bot is in the guild)
    const guildsWithStickers = await Promise.all(
      ownedGuilds.map(async (guild) => {
        let stickers = [];
        const storedInviteCode = storedInvites[guild.id]?.code || null;
        let botIsAdmin = false;
        
        // First, try with bot token if bot is installed in the guild
        if (process.env.DISCORD_BOT_TOKEN) {
          try {
            const stickersResponse = await axios.get(
              `${DISCORD_API}/guilds/${guild.id}/stickers`,
              {
                headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
              }
            );
            stickers = stickersResponse.data;
            console.log(`✓ Fetched ${stickers.length} stickers for guild ${guild.name} (${guild.id})`);
            
            // Check if bot has admin permissions (with caching to avoid rate limits)
            const cachedStatus = botAdminCache.get(guild.id);
            if (cachedStatus && (Date.now() - cachedStatus.timestamp) < BOT_ADMIN_CACHE_DURATION) {
              botIsAdmin = cachedStatus.isAdmin;
              console.log(`✓ Using cached admin status for ${guild.name}: ${botIsAdmin}`);
            } else {
              try {
                const botMemberResponse = await axios.get(
                  `${DISCORD_API}/guilds/${guild.id}/members/${CLIENT_ID}`,
                  {
                    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
                  }
                );
                
                // Get bot's roles
                const rolesResponse = await axios.get(
                  `${DISCORD_API}/guilds/${guild.id}/roles`,
                  {
                    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
                  }
                );
                
                // Check if any of the bot's roles has Administrator permission (bit 8)
                const botRoleIds = botMemberResponse.data.roles;
                const botRoles = rolesResponse.data.filter(role => botRoleIds.includes(role.id));
                
                // Discord permissions are stored as strings, need to use BigInt for large numbers
                botIsAdmin = botRoles.some(role => {
                  try {
                    const permissions = BigInt(role.permissions);
                    const hasAdmin = (permissions & BigInt(0x8)) === BigInt(0x8);
                    if (hasAdmin) {
                      console.log(`✓ Role "${role.name}" has admin permission in ${guild.name}`);
                    }
                    return hasAdmin;
                  } catch (e) {
                    return false;
                  }
                });
                
                // Cache the result
                botAdminCache.set(guild.id, {
                  isAdmin: botIsAdmin,
                  timestamp: Date.now()
                });
                
                console.log(`✓ Bot admin status for ${guild.name}: ${botIsAdmin}`);
              } catch (permError) {
                console.log(`✗ Cannot check bot permissions for guild ${guild.name}: ${permError.response?.data?.message || permError.message}`);
              }
            }
          } catch (error) {
            // Bot not in guild or doesn't have permission
            console.log(`✗ Cannot fetch stickers for guild ${guild.name} (${guild.id}): ${error.response?.data?.message || error.message}`);
          }
        }
        
        return {
          ...guild,
          stickers: stickers,
          bot_in_guild: stickers.length > 0 || false,
          bot_is_admin: botIsAdmin,
          stored_invite: storedInviteCode
        };
      })
    );

    res.json(guildsWithStickers);
  } catch (error) {
    console.error('Guilds fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

app.get('/api/check-auth', (req, res) => {
  if (!config.setupComplete) {
    return res.json({ 
      authenticated: false,
      setupRequired: true
    });
  }

  res.json({ 
    authenticated: !!req.session.accessToken && req.session.userId === config.adminUserId,
    username: req.session.username || null,
    setupRequired: false
  });
});

app.get('/api/bot-invite-url', (req, res) => {
  const permissions = '0'; // No special permissions needed to just read stickers
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${permissions}&scope=bot`;
  res.json({ inviteUrl });
});

// Get bot admin invite URL for specific guild
app.get('/api/bot-admin-url/:guildId?', (req, res) => {
  const { guildId } = req.params;
  // Permission bits: 8 = Administrator (or you can use 32 for just MANAGE_GUILD)
  const permissions = '8'; // Administrator permission
  let inviteUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=${permissions}&scope=bot`;
  
  if (guildId) {
    inviteUrl += `&guild_id=${guildId}&disable_guild_select=true`;
  }
  
  res.json({ 
    inviteUrl,
    permissions: permissions === '8' ? 'Administrator' : 'Manage Server'
  });
});

// Update guild settings (name and/or icon)
app.patch('/api/guilds/:guildId', requireSetup, requireAdmin, upload.single('icon'), async (req, res) => {
  const { guildId } = req.params;
  const { name } = req.body;

  try {
    const updateData = {};

    // Add name if provided
    if (name && name.trim()) {
      updateData.name = name.trim();
    }

    // Add icon if provided
    if (req.file) {
      // Convert to base64 data URI
      const base64Image = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;
      updateData.icon = `data:${mimeType};base64,${base64Image}`;
    }

    // If nothing to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No data provided to update' });
    }

    // Update the guild
    const response = await axios.patch(
      `${DISCORD_API}/guilds/${guildId}`,
      updateData,
      {
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Clear the cache to force refresh
    publicStickersCache = null;

    res.json({
      success: true,
      guild: response.data
    });
  } catch (error) {
    console.error('Guild update error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to update guild'
    });
  }
});

// Create permanent invite for a guild
app.post('/api/guilds/:guildId/create-invite', requireSetup, requireAdmin, async (req, res) => {
  const { guildId } = req.params;

  try {
    // First check if there's already a stored invite
    let inviteCode = await getStoredInvite(guildId);
    if (inviteCode) {
      return res.json({ 
        success: true, 
        invite_code: inviteCode,
        message: 'Using stored permanent invite'
      });
    }

    // Check if there's already a permanent invite in Discord
    try {
      const invitesResponse = await axios.get(
        `${DISCORD_API}/guilds/${guildId}/invites`,
        {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
        }
      );
      const permanentInvite = invitesResponse.data.find(inv => inv.max_age === 0);
      if (permanentInvite) {
        await saveInvite(guildId, permanentInvite.code);
        return res.json({ 
          success: true, 
          invite_code: permanentInvite.code,
          message: 'Permanent invite already exists'
        });
      }
    } catch (err) {
      // Continue to create new invite
    }

    // Get guild channels
    const channelsResponse = await axios.get(
      `${DISCORD_API}/guilds/${guildId}/channels`,
      {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
      }
    );

    // Find a text channel (type 0) or any channel
    const textChannel = channelsResponse.data.find(ch => ch.type === 0) || channelsResponse.data[0];

    if (!textChannel) {
      return res.status(400).json({ error: 'No suitable channel found' });
    }

    // Create a permanent invite
    const createInviteResponse = await axios.post(
      `${DISCORD_API}/channels/${textChannel.id}/invites`,
      {
        max_age: 0,        // Permanent
        max_uses: 0,       // Unlimited uses
        unique: false,
        temporary: false
      },
      {
        headers: { 
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    inviteCode = createInviteResponse.data.code;
    
    // Store the invite code
    await saveInvite(guildId, inviteCode);

    // Clear the cache to force refresh
    publicStickersCache = null;

    res.json({ 
      success: true, 
      invite_code: inviteCode,
      message: 'Invite created successfully'
    });
  } catch (error) {
    console.error('Create invite error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Failed to create invite'
    });
  }
});

// Redirect root to setup if not configured, otherwise show public page
app.get('/', (req, res) => {
  if (!config.setupComplete) {
    return res.redirect('/setup');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin page
app.get('/admin', requireSetup, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Discord Stickers Showcase running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`⚙️  Setup complete: ${config.setupComplete ? 'Yes' : 'No'}`);
  if (!config.setupComplete) {
    console.log(`\n👉 Visit http://localhost:${PORT}/setup to complete setup`);
  }
});
