<div align="center">
  <img src="https://gabemade.unobtuse.com/images/logo-darkmode.svg" alt="Logo" width="200"/>
</div>

# 🎨 Discord Stickers Showcase

A beautiful, self-hosted web application to showcase all your Discord server stickers in one place with a stunning glassmorphic design.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

## ✨ Features

### 🌐 Public Showcase
- **Gorgeous Grid Layout** - Display all stickers in a responsive grid
- **Glassmorphic Design** - Modern frosted glass aesthetic with grayscale colors
- **Direct Server Links** - Click any sticker to join its Discord server
- **Smart Caching** - Fast loading with intelligent cache management

### 🔐 Admin Panel
- **Discord OAuth Login** - Secure authentication via Discord
- **Server Management** - View and manage all your Discord servers
- **Edit Server Settings** - Change server names and icons directly
- **Create Invite Links** - Generate permanent invite codes for servers
- **Bot Permission Management** - Easy bot admin setup with one click
- **Persistent Storage** - Invite codes saved automatically

### 🎯 Design
- **Inter Font** - Beautiful typography throughout
- **Grayscale Only** - Pure black, white, and gray aesthetic
- **Responsive** - Works perfectly on all devices
- **Smooth Animations** - Polished hover effects and transitions

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ installed
- A Discord account
- Discord servers with stickers (where you're the owner)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/discord-stickers-showcase.git
   cd discord-stickers-showcase
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" section and create a bot
   - Copy the bot token
   - Go to "OAuth2" section and note your Client ID and Client Secret
   - Add redirect URI: `http://localhost:3000/auth/callback`

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your Discord credentials:
   ```env
   DISCORD_BOT_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_CLIENT_SECRET=your_client_secret_here
   REDIRECT_URI=http://localhost:3000/auth/callback
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Complete setup**
   - Visit `http://localhost:3000`
   - Follow the setup wizard
   - Login with Discord
   - You're now the admin!

## 📖 Detailed Setup

See [SETUP.md](SETUP.md) for comprehensive setup instructions including:
- Creating a Discord application
- Configuring OAuth2
- Setting up the bot
- Production deployment
- Reverse proxy configuration

## 🎮 Usage

### Adding Bot to Servers

1. Go to the admin panel: `http://localhost:3000/admin`
2. Click the bot invite link
3. Select servers to add the bot to
4. Authorize the bot

### Creating Invite Links

1. In the admin panel, find a server card
2. Click "Create Permanent Invite"
3. The invite link will be saved automatically
4. Stickers from this server will now link to the invite

### Granting Bot Admin

1. In the admin panel, find a server card
2. Click "🔑 Make Bot Admin"
3. Authorize the bot with Administrator permissions
4. You can now edit server names and icons

## 📁 Project Structure

```
.
├── server.js              # Main Express server
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
├── setup/
│   └── setup.html         # Setup wizard page
├── public/
│   ├── index.html         # Public stickers grid
│   ├── style.css          # Public page styles
│   ├── app.js             # Public page logic
│   └── admin/
│       ├── index.html     # Admin dashboard
│       ├── style.css      # Admin dashboard styles
│       └── app.js         # Admin dashboard logic
└── data/
    ├── config.json        # Auto-generated config
    └── invites.json       # Stored invite codes
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_BOT_TOKEN` | Yes | Your Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Your Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Yes | Your Discord application client secret |
| `REDIRECT_URI` | Yes | OAuth redirect URI |
| `PORT` | No | Server port (default: 3000) |
| `SESSION_SECRET` | No | Session secret (auto-generated if not set) |
| `NODE_ENV` | No | Set to `production` for production |

### Data Files

- `data/config.json` - Stores admin user ID and setup status
- `data/invites.json` - Stores permanent invite codes for servers

## 🌍 Production Deployment

### Using PM2

```bash
npm install -g pm2
pm2 start server.js --name discord-stickers
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Don't forget to:
1. Update `REDIRECT_URI` in `.env` to your production domain
2. Add your production redirect URI in Discord Developer Portal
3. Set `NODE_ENV=production` in `.env`

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Styled with [Inter Font](https://rsms.me/inter/)
- Inspired by modern glassmorphic design trends

## 💬 Support

If you have any questions or need help:
- Open an issue on GitHub
- Check the [SETUP.md](SETUP.md) for detailed instructions

---

Made with ❤️ and ☕
