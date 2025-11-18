require('dotenv').config();
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const fs = require('fs').promises;
const fsSync = require('fs');

// Configure multer for file uploads (in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'discord-stickers-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true
  }
}));

// Serve public files at root
app.use(express.static('public', { index: false }));

// Serve admin files
app.use('/admin', express.static('public/admin'));

const DISCORD_API = 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

// Admin whitelist
const ADMIN_USERNAME = 'defnotnellz';

// Cache for public stickers
let publicStickersCache = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache for bot admin status per guild
const botAdminCache = new Map();
const BOT_ADMIN_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Invites storage file
const INVITES_FILE = path.join(__dirname, 'data', 'invites.json');
const OG_CONFIG_FILE = path.join(__dirname, 'data', 'og-config.json');

// Ensure data directory exists
if (!fsSync.existsSync(path.join(__dirname, 'data'))) {
  fsSync.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Default Open Graph configuration
const DEFAULT_OG_CONFIG = {
  title: 'Discord Stickers Showcase',
  description: 'Explore our collection of Discord stickers from various servers',
  image: 'https://via.placeholder.com/1200x630/0a0a0a/ffffff?text=Discord+Stickers',
  url: '',
  type: 'website',
  siteName: 'Discord Stickers Showcase'
};

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

// Helper functions for OG config storage
async function loadOGConfig() {
  try {
    const data = await fs.readFile(OG_CONFIG_FILE, 'utf8');
    return { ...DEFAULT_OG_CONFIG, ...JSON.parse(data) };
  } catch (error) {
    return DEFAULT_OG_CONFIG;
  }
}

async function saveOGConfig(config) {
  try {
    await fs.writeFile(OG_CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving OG config:', error);
    return false;
  }
}

// Middleware to check if user is authorized admin
function requireAdmin(req, res, next) {
  if (!req.session.accessToken || !req.session.username) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  if (req.session.username !== ADMIN_USERNAME) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  next();
}

// Root route - serve public page with server-rendered OG tags
app.get('/', async (req, res) => {
  try {
    // Load OG config
    const ogConfig = await loadOGConfig();
    
    // Read the HTML file
    let html = await fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8');
    
    // Get the full URL for the site
    const siteUrl = ogConfig.url || `${req.protocol}://${req.get('host')}`;
    
    // Replace meta tag content with actual values
    html = html.replace('content="website" id="og-type"', `content="${ogConfig.type}" id="og-type"`);
    html = html.replace('content="" id="og-url"', `content="${siteUrl}" id="og-url"`);
    html = html.replace('content="Discord Stickers Showcase" id="og-title"', `content="${ogConfig.title}" id="og-title"`);
    html = html.replace('content="Explore our collection of Discord stickers from various servers" id="og-description"', `content="${ogConfig.description}" id="og-description"`);
    html = html.replace('content="https://via.placeholder.com/1200x630/0a0a0a/ffffff?text=Discord+Stickers" id="og-image"', `content="${ogConfig.image}" id="og-image"`);
    html = html.replace('content="Discord Stickers Showcase" id="og-site-name"', `content="${ogConfig.siteName}" id="og-site-name"`);
    
    // Replace Twitter card values
    html = html.replace('content="" id="twitter-url"', `content="${siteUrl}" id="twitter-url"`);
    html = html.replace('content="Discord Stickers Showcase" id="twitter-title"', `content="${ogConfig.title}" id="twitter-title"`);
    html = html.replace('content="Explore our collection of Discord stickers from various servers" id="twitter-description"', `content="${ogConfig.description}" id="twitter-description"`);
    html = html.replace('content="https://via.placeholder.com/1200x630/0a0a0a/ffffff?text=Discord+Stickers" id="twitter-image"', `content="${ogConfig.image}" id="twitter-image"`);
    
    // Replace page title
    html = html.replace('<title>Discord Stickers Collection</title>', `<title>${ogConfig.title}</title>`);
    
    res.send(html);
  } catch (error) {
    console.error('Error serving index with OG tags:', error);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Admin route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// OAuth2 routes
app.get('/login', (req, res) => {
  const authUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI + '/admin/callback')}&response_type=code&scope=identify%20guilds`;
  res.redirect(authUrl);
});

app.get('/admin/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.redirect('/admin?error=no_code');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(`${DISCORD_API}/oauth2/token`, 
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI + '/admin/callback'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const accessToken = tokenResponse.data.access_token;
    
    // Fetch user info to check authorization
    const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const username = userResponse.data.username;
    
    // Check if user is authorized admin
    if (username !== ADMIN_USERNAME) {
      console.log(`Unauthorized access attempt by: ${username}`);
      return res.redirect('/admin?error=unauthorized');
    }
    
    // Store session data
    req.session.accessToken = accessToken;
    req.session.username = username;
    req.session.userId = userResponse.data.id;
    
    res.redirect('/admin');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.redirect('/admin?error=auth_failed');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
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
          console.error(`Failed to fetch stickers for guild ${guild.id}:`, error.response?.data || error.message);
        }
      })
    );

    publicStickersCache = allStickers;
    lastCacheUpdate = Date.now();
    
    res.json(allStickers);
  } catch (error) {
    console.error('Public stickers fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch stickers' });
  }
});

// API endpoints
app.get('/api/user', requireAdmin, async (req, res) => {
  try {
    const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${req.session.accessToken}` }
    });
    res.json(userResponse.data);
  } catch (error) {
    console.error('User fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.get('/api/guilds', requireAdmin, async (req, res) => {
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
  res.json({ 
    authenticated: !!req.session.accessToken && req.session.username === ADMIN_USERNAME,
    username: req.session.username || null
  });
});

// Get Open Graph configuration
app.get('/api/og-config', async (req, res) => {
  try {
    const config = await loadOGConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load OG config' });
  }
});

// Upload OG preview image
app.post('/api/og-upload-image', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'public', 'uploads');
    if (!fsSync.existsSync(uploadsDir)) {
      fsSync.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(req.file.originalname);
    const filename = `og-preview-${Date.now()}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    // Write file
    await fs.writeFile(filepath, req.file.buffer);

    // Return URL
    const imageUrl = `/uploads/${filename}`;
    res.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Update Open Graph configuration (admin only)
app.post('/api/og-config', requireAdmin, async (req, res) => {
  try {
    const { title, description, image, url, type, siteName } = req.body;
    
    const config = {
      title: title || DEFAULT_OG_CONFIG.title,
      description: description || DEFAULT_OG_CONFIG.description,
      image: image || DEFAULT_OG_CONFIG.image,
      url: url || DEFAULT_OG_CONFIG.url,
      type: type || DEFAULT_OG_CONFIG.type,
      siteName: siteName || DEFAULT_OG_CONFIG.siteName
    };
    
    const saved = await saveOGConfig(config);
    
    if (saved) {
      res.json({ success: true, config });
    } else {
      res.status(500).json({ error: 'Failed to save OG config' });
    }
  } catch (error) {
    console.error('OG config update error:', error);
    res.status(500).json({ error: 'Failed to update OG config' });
  }
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
app.patch('/api/guilds/:guildId', requireAdmin, upload.single('icon'), async (req, res) => {
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
      // Convert image to base64 data URI
      const base64Image = req.file.buffer.toString('base64');
      updateData.icon = `data:${req.file.mimetype};base64,${base64Image}`;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    // Update guild via Discord API
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

    // Clear the guilds cache
    publicStickersCache = null;

    res.json({ 
      success: true, 
      guild: response.data,
      message: 'Guild updated successfully'
    });
  } catch (error) {
    console.error('Update guild error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: error.response?.data?.message || 'Failed to update guild'
    });
  }
});

// Create invite for a specific guild
app.post('/api/guilds/:guildId/create-invite', requireAdmin, async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
