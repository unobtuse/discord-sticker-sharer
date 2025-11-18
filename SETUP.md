# 📚 Complete Setup Guide

This guide will walk you through setting up Discord Stickers Showcase step by step.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating a Discord Application](#creating-a-discord-application)
3. [Configuring the Bot](#configuring-the-bot)
4. [Setting Up OAuth2](#setting-up-oauth2)
5. [Installing the Application](#installing-the-application)
6. [First-Time Setup](#first-time-setup)
7. [Production Deployment](#production-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 14 or higher** installed ([Download](https://nodejs.org/))
- A **Discord account**
- **Owner permissions** for at least one Discord server with stickers
- Basic command line knowledge
- (For production) A server with a public IP or domain name

---

## Creating a Discord Application

### Step 1: Go to Discord Developer Portal

1. Visit [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **"New Application"** in the top right
3. Give your application a name (e.g., "My Stickers Showcase")
4. Click **"Create"**

### Step 2: Note Your Client ID

1. On the **"General Information"** page, you'll see:
   - **Application ID** (this is your Client ID)
   - Copy this and save it - you'll need it later

### Step 3: Get Your Client Secret

1. Still on **"General Information"**
2. Under **"Client Secret"**, click **"Reset Secret"**
3. Confirm the action
4. Copy the secret that appears - **save it securely** (you won't see it again!)

---

## Configuring the Bot

### Step 1: Create a Bot

1. In the left sidebar, click **"Bot"**
2. Click **"Reset Token"** or **"Add Bot"** (if no bot exists)
3. Confirm by clicking **"Yes, do it!"**
4. Copy the token that appears - **save it securely!**

### Step 2: Configure Bot Permissions

1. Scroll down to **"Privileged Gateway Intents"**
2. You can leave all intents **OFF** (we don't need special intents)
3. Scroll down to **"Bot Permissions"**
4. Make note that we'll request permissions when adding the bot to servers

### Step 3: Bot Settings (Optional but Recommended)

- **Public Bot**: Turn **OFF** if you want only you to add the bot
- **Requires OAuth2 Code Grant**: Leave **OFF**

---

## Setting Up OAuth2

### Step 1: Add Redirect URI

1. In the left sidebar, click **"OAuth2"** > **"General"**
2. Under **"Redirects"**, click **"Add Redirect"**
3. Enter your redirect URI:
   - **Local development**: `http://localhost:3000/auth/callback`
   - **Production**: `https://yourdomain.com/auth/callback`
4. Click **"Save Changes"**

**Important**: You can add multiple redirect URIs (one for dev, one for production)

---

## Installing the Application

### Step 1: Clone or Download

```bash
# If using git:
git clone https://github.com/yourusername/discord-stickers-showcase.git
cd discord-stickers-showcase

# Or download and extract the ZIP file, then cd into the folder
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- Express.js (web server)
- Axios (HTTP client)
- express-session (session management)
- dotenv (environment variables)
- multer (file uploads)

### Step 3: Create Environment File

```bash
cp .env.example .env
```

### Step 4: Edit .env File

Open `.env` in your favorite text editor and fill in the values:

```env
# Paste the bot token from Step "Configuring the Bot"
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN_HERE

# Paste the Application ID from "General Information"
DISCORD_CLIENT_ID=YOUR_CLIENT_ID_HERE

# Paste the Client Secret from "General Information"
DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE

# Use the same redirect URI you added in OAuth2 settings
REDIRECT_URI=http://localhost:3000/auth/callback

# Port to run on (3000 is default)
PORT=3000

# Session secret (optional - will auto-generate if not set)
SESSION_SECRET=
```

**Generate a session secret** (optional but recommended):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and paste it as `SESSION_SECRET` in your `.env` file.

---

## First-Time Setup

### Step 1: Start the Server

```bash
npm start
```

You should see:
```
🚀 Discord Stickers Showcase running on port 3000
📍 Local: http://localhost:3000
⚙️  Setup complete: No

👉 Visit http://localhost:3000/setup to complete setup
```

### Step 2: Open Setup Page

1. Open your browser and go to `http://localhost:3000`
2. You'll be redirected to the setup wizard
3. Click **"Get Started"**

### Step 3: Configuration Check

The setup wizard will check if your `.env` file is configured correctly.

✅ **If all checks pass**: Click "Next"
❌ **If checks fail**: Double-check your `.env` file and restart the server

### Step 4: Login with Discord

1. Click **"Login with Discord"**
2. You'll be redirected to Discord's authorization page
3. Click **"Authorize"**
4. You'll be redirected back to the setup page

**Congratulations!** You are now the admin. 🎉

### Step 5: Add Bot to Servers

1. You'll be redirected to the admin panel
2. Look for **"Bot Not In Any Servers"** notice
3. Click the bot invite link
4. Select servers where you want to add the bot
5. Authorize the bot
6. Refresh the admin page

### Step 6: Create Invite Links

For each server:
1. Click **"Create Permanent Invite"**
2. The invite will be created and saved automatically
3. Now stickers from this server will link to the invite

### Step 7: Grant Admin Permissions (Optional)

If you want to edit server names/icons:
1. Click **"🔑 Make Bot Admin"** on each server card
2. Authorize the bot with Administrator permissions
3. Refresh the page - button will show "✅ Bot Is Admin"
4. Now you can click "✏️ Edit Server"

---

## Production Deployment

### Option 1: VPS or Dedicated Server

#### Using PM2 (Recommended)

1. **Install PM2 globally**:
   ```bash
   npm install -g pm2
   ```

2. **Update .env for production**:
   ```env
   REDIRECT_URI=https://yourdomain.com/auth/callback
   NODE_ENV=production
   ```

3. **Update Discord OAuth2 Redirect**:
   - Go to Discord Developer Portal
   - Add `https://yourdomain.com/auth/callback` to redirects

4. **Start with PM2**:
   ```bash
   pm2 start server.js --name discord-stickers
   pm2 save
   pm2 startup
   ```

5. **Configure reverse proxy** (see Nginx example in README.md)

#### Using systemd

Create `/etc/systemd/system/discord-stickers.service`:
```ini
[Unit]
Description=Discord Stickers Showcase
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/discord-stickers-showcase
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable discord-stickers
sudo systemctl start discord-stickers
```

### Option 2: Docker

1. **Build the image**:
   ```bash
   docker build -t discord-stickers .
   ```

2. **Run the container**:
   ```bash
   docker run -d \
     --name discord-stickers \
     -p 3000:3000 \
     -v $(pwd)/data:/app/data \
     --env-file .env \
     discord-stickers
   ```

### Option 3: Platform-as-a-Service

#### Heroku

1. Create `Procfile`:
   ```
   web: node server.js
   ```

2. Deploy:
   ```bash
   heroku create your-app-name
   heroku config:set DISCORD_BOT_TOKEN=xxx
   heroku config:set DISCORD_CLIENT_ID=xxx
   heroku config:set DISCORD_CLIENT_SECRET=xxx
   heroku config:set REDIRECT_URI=https://your-app-name.herokuapp.com/auth/callback
   git push heroku main
   ```

#### Railway.app

1. Push to GitHub
2. Connect Railway to your repo
3. Add environment variables in Railway dashboard
4. Deploy!

---

## Troubleshooting

### "Setup incomplete" error

**Problem**: Getting redirected to setup even after completing it.

**Solution**:
- Check if `data/config.json` exists and has `setupComplete: true`
- If missing, the file will be recreated on next setup

### OAuth redirect errors

**Problem**: Getting "redirect_uri_mismatch" error.

**Solution**:
- Make sure `REDIRECT_URI` in `.env` matches **exactly** what's in Discord Developer Portal
- Include the full URL including `/auth/callback`
- Check for typos (http vs https, trailing slashes, etc.)

### Bot can't fetch stickers

**Problem**: Seeing "Bot not in guild" errors.

**Solution**:
- Make sure the bot is added to your Discord servers
- Use the bot invite link from the admin panel
- The bot needs to be in a server to fetch its stickers

### "Rate limited" errors

**Problem**: Getting rate limit errors when checking bot permissions.

**Solution**:
- The app caches permission checks for 2 minutes
- Wait a minute and try again
- This happens when checking too many servers at once

### Stickers not showing on public page

**Problem**: Public page shows "No stickers" but admin panel shows stickers.

**Solution**:
- Make sure invite codes are created for your servers
- Check browser console for errors
- Try clearing the cache: `publicStickersCache = null` in code or restart server

### Can't edit server name/icon

**Problem**: Getting "Missing Permissions" error when editing.

**Solution**:
- Click "🔑 Make Bot Admin" on that server card
- Authorize the bot with Administrator permissions
- Refresh the admin page
- Button should show "✅ Bot Is Admin"
- Now try editing again

### Session expires immediately

**Problem**: Getting logged out every page refresh.

**Solution**:
- Make sure `SESSION_SECRET` is set in `.env`
- If not set, a new secret is generated each restart
- Generate a permanent secret and add it to `.env`

### Port already in use

**Problem**: Error "port 3000 already in use".

**Solution**:
- Change `PORT` in `.env` to a different number (e.g., 3001)
- Or stop the other process using port 3000

---

## Advanced Configuration

### Multiple Admins

Currently only one admin is supported (the first person to login). To add multiple admins:

1. Manually edit `data/config.json`
2. Change `adminUserId` to an array: `adminUserIds: ["id1", "id2"]`
3. Update the `requireAdmin` middleware in `server.js` to check array

### Custom Styling

All styles are in CSS files:
- Public page: `public/style.css`
- Admin page: `public/admin/style.css`

Feel free to customize colors, fonts, layouts!

### Cache Duration

Adjust caching in `server.js`:
```javascript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const BOT_ADMIN_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
```

---

## Need More Help?

- Check the [README.md](README.md) for an overview
- Open an issue on GitHub
- Review the code comments in `server.js`

---

**Happy showcasing!** 🎨
