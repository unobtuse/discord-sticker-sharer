# ⚡ Quick Start Guide

Get up and running in **5 minutes**!

## Prerequisites
- Node.js 14+ installed
- A Discord account

## Steps

### 1️⃣ Install
```bash
npm install
```

### 2️⃣ Create Discord App
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Go to "Bot" → Create bot → Copy token
4. Go to "OAuth2" → Copy Client ID and Client Secret
5. Add redirect: `http://localhost:3000/auth/callback`

### 3️⃣ Configure
```bash
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_BOT_TOKEN=paste_bot_token_here
DISCORD_CLIENT_ID=paste_client_id_here
DISCORD_CLIENT_SECRET=paste_secret_here
REDIRECT_URI=http://localhost:3000/auth/callback
```

### 4️⃣ Start
```bash
npm start
```

### 5️⃣ Setup
1. Visit http://localhost:3000
2. Follow setup wizard
3. Login with Discord
4. You're the admin! 🎉

## Next Steps

### Add Bot to Servers
1. Go to http://localhost:3000/admin
2. Click bot invite link
3. Select servers
4. Authorize

### Create Invites
1. On each server card, click "Create Permanent Invite"
2. Done! Stickers now link to servers

### Grant Admin (Optional)
1. Click "🔑 Make Bot Admin" on a server
2. Authorize with admin permissions
3. Now you can edit server name/icon

## Production Deploy

### Using PM2
```bash
npm install -g pm2
pm2 start server.js --name discord-stickers
pm2 save
```

Update `.env`:
```env
REDIRECT_URI=https://yourdomain.com/auth/callback
NODE_ENV=production
```

Don't forget to update Discord redirect URI too!

## Need Help?
- Read [SETUP.md](SETUP.md) for detailed guide
- Read [README.md](README.md) for features overview
- Check [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) for package info

---

**That's it!** 🚀 Your stickers showcase is ready!
