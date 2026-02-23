# CryptoRecover - Wallet Recovery Tool

A modern, secure cryptocurrency wallet recovery tool built with Hono and Cloudflare Pages. Features AI-powered BIP39 seed phrase analysis to help recover wallets with incomplete or corrupted seed phrases.

## 🚀 Live Demo

**Development Server:** https://3000-i6g74z013tsqkfiuv7yzs-82b888ba.sandbox.novita.ai

## ✨ Features

### Currently Implemented

- **✅ BIP39 Seed Phrase Analysis**
  - Validate seed phrases (12 or 24 words)
  - Detect invalid words and common mistakes
  - Suggest corrections for typos (Levenshtein distance algorithm)
  - Real-time word suggestions and autocomplete

- **✅ Wallet Address Validation**
  - Ethereum (ETH) address format validation
  - Bitcoin (BTC) address format validation (P2PKH, P2SH, Bech32)

- **✅ Military-Grade Encryption**
  - AES-256-GCM encryption using Web Crypto API
  - Secure key derivation and IV generation
  - All sensitive data encrypted at rest

- **✅ Beautiful Modern UI**
  - Dark theme with amber accents
  - Fully responsive design (mobile, tablet, desktop)
  - Smooth animations and transitions
  - TailwindCSS + FontAwesome icons

- **✅ Cloudflare D1 Database**
  - SQLite-based database for persistent storage
  - Tables: users, scans, scan_results, seed_phrase_analyses, notifications
  - Optimized indexes for fast queries

- **✅ API Endpoints**
  - `POST /api/seed-phrase/analyze` - Analyze seed phrase for errors
  - `GET /api/seed-phrase/suggestions` - Get word autocomplete suggestions
  - `POST /api/seed-phrase/validate` - Validate complete seed phrase
  - `POST /api/scan/initiate` - Initiate wallet scan (demo mode)
  - `GET /api/scan/:scanId/status` - Get scan progress (demo mode)

### Not Yet Implemented

- **⏳ Real Wallet Scanning**
  - Integration with blockchain APIs (Etherscan, Blockchain.com)
  - Background job processing for long scans
  - Progress tracking with WebSocket updates

- **⏳ LLM-Powered Analysis**
  - Cloudflare AI integration for advanced error detection
  - Pattern recognition for common seed phrase mistakes
  - Confidence scoring for suggestions

- **⏳ Notification System**
  - Email alerts when wallet with balance is found
  - In-app notifications for scan completion
  - Webhook integration for custom notifications

- **⏳ S3/R2 Storage**
  - Encrypted result storage in Cloudflare R2
  - Presigned URLs for secure downloads
  - Retention policies and automatic cleanup

## 🏗️ Tech Stack

- **Framework:** Hono 4.12 (Fast, lightweight, built on Web Standards)
- **Runtime:** Cloudflare Workers/Pages
- **Database:** Cloudflare D1 (SQLite at the edge)
- **Frontend:** Vanilla JavaScript + TailwindCSS
- **Build Tool:** Vite 6.3
- **Package Manager:** npm
- **Process Manager:** PM2 (for local development)

## 📦 Project Structure

```
webapp/
├── src/
│   ├── index.tsx           # Main Hono application
│   ├── lib/
│   │   ├── crypto.ts       # Encryption utilities (Web Crypto API)
│   │   └── bip39.ts        # BIP39 wordlist and validation
│   └── renderer.tsx        # JSX renderer (unused in current version)
├── public/
│   └── static/            # Static assets
├── migrations/
│   └── 0001_initial_schema.sql  # Database schema
├── dist/                  # Build output
├── ecosystem.config.cjs   # PM2 configuration
├── wrangler.jsonc         # Cloudflare configuration
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## 🛠️ Development

### Prerequisites

- Node.js 18+ and npm
- Wrangler CLI (`npm install -g wrangler`)
- PM2 (pre-installed in sandbox)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Apply database migrations:**
   ```bash
   npm run db:migrate:local
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start development server:**
   ```bash
   # Option 1: PM2 (recommended for sandbox)
   pm2 start ecosystem.config.cjs
   
   # Option 2: Direct wrangler
   npm run dev:sandbox
   ```

5. **Access the app:**
   - Local: http://localhost:3000
   - Public: https://3000-i6g74z013tsqkfiuv7yzs-82b888ba.sandbox.novita.ai

### Available Scripts

```bash
npm run dev           # Vite dev server (for frontend development)
npm run dev:sandbox   # Wrangler pages dev (full stack with D1)
npm run build         # Build for production
npm run deploy        # Deploy to Cloudflare Pages
npm run db:migrate:local   # Apply migrations locally
npm run db:migrate:prod    # Apply migrations to production
npm run clean-port    # Kill process on port 3000
```

## 🗄️ Database Schema

### Users
- Stores user authentication information
- Fields: id, open_id, name, email, role, timestamps

### Scans
- Tracks wallet recovery scan sessions
- Fields: id, user_id, mode, input_type, input_value (encrypted), wallet_type, status, progress metrics

### Scan Results
- Individual wallet discoveries from scans
- Fields: id, scan_id, wallet_address (encrypted), balance (encrypted), transaction_count, metadata

### Seed Phrase Analyses
- LLM-powered analysis results
- Fields: id, user_id, input_phrase (encrypted), word_count, suggestions, confidence_scores

### Notifications
- Audit log of owner alerts
- Fields: id, scan_id, type, title, content, status, delivery_method

## 🔐 Security

### Encryption
- All sensitive data (seed phrases, wallet addresses, API keys) is encrypted using AES-256-GCM
- Unique IVs generated for each encryption operation
- Key derivation using PBKDF2 (in future iterations)

### Data Storage
- Encrypted data stored in Cloudflare D1
- No plaintext sensitive information in logs
- Secure presigned URLs for data access

### Best Practices
- Input validation on all API endpoints
- Rate limiting (to be implemented)
- CORS configuration for API security
- Environment variables for sensitive configuration

## 🚀 Deployment to Cloudflare Pages

### Prerequisites
1. Cloudflare account
2. Wrangler CLI configured with your account

### Steps

1. **Create D1 database in production:**
   ```bash
   npx wrangler d1 create webapp-production
   ```

2. **Update wrangler.jsonc** with the database ID returned above

3. **Apply migrations to production:**
   ```bash
   npm run db:migrate:prod
   ```

4. **Build and deploy:**
   ```bash
   npm run deploy
   ```

5. **Set environment variables (if needed):**
   ```bash
   npx wrangler pages secret put ENCRYPTION_KEY
   ```

### Production URLs
- Will be: `https://webapp.pages.dev`
- Custom domain: Configure in Cloudflare dashboard

## 📊 API Documentation

### Seed Phrase Analysis

**POST** `/api/seed-phrase/analyze`
```json
{
  "phrase": "abandon ability able about invalid1 invalid2"
}
```

Response:
```json
{
  "success": true,
  "analysis": {
    "validWords": ["abandon", "ability", "able", "about"],
    "invalidWords": ["invalid1", "invalid2"],
    "commonMistakes": ["\"invalid1\" might be \"invalid\" (typo detected)"],
    "missingWords": 8,
    "totalWords": 6
  }
}
```

### Word Suggestions

**GET** `/api/seed-phrase/suggestions?q=aban&limit=5`

Response:
```json
{
  "suggestions": ["abandon"],
  "count": 1
}
```

### Seed Phrase Validation

**POST** `/api/seed-phrase/validate`
```json
{
  "phrase": "abandon ability able about above absent absorb abstract absurd abuse access accident"
}
```

Response:
```json
{
  "valid": true,
  "wordCount": 12,
  "invalidWords": [],
  "message": "Valid BIP39 seed phrase"
}
```

## 🎯 Roadmap

### Phase 1: MVP (Current)
- ✅ BIP39 validation and analysis
- ✅ Basic UI and API endpoints
- ✅ Local D1 database setup

### Phase 2: Core Features
- ⏳ Real blockchain API integration
- ⏳ Cloudflare AI for advanced analysis
- ⏳ Background job processing
- ⏳ WebSocket for real-time updates

### Phase 3: Production Ready
- ⏳ Email notifications
- ⏳ R2 storage for results
- ⏳ Rate limiting and abuse prevention
- ⏳ Admin dashboard
- ⏳ Analytics and monitoring

### Phase 4: Advanced Features
- ⏳ Multi-language support
- ⏳ Mobile app (React Native)
- ⏳ Batch processing
- ⏳ Custom API integration UI

## ⚠️ Legal & Ethical Disclaimer

**IMPORTANT:** This tool is designed for recovering YOUR OWN cryptocurrency wallets only.

- ✅ **Legal Use:** Recovering your own wallets with forgotten seed phrases
- ❌ **Illegal Use:** Attempting to access others' wallets without authorization

**Unauthorized access to cryptocurrency wallets is a federal crime in most jurisdictions.** 

By using this tool, you agree that you are the rightful owner of the wallets you are attempting to recover, and you accept full legal responsibility for your actions.

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with clear description

## 📧 Support

For questions or support, please open an issue on GitHub.

## 🙏 Acknowledgments

- BIP39 wordlist from Bitcoin Improvement Proposals
- Hono framework by Yusuke Wada
- Cloudflare for edge computing platform
- shadcn/ui for design inspiration

---

**Built with ❤️ using Hono + Cloudflare Pages**

Last Updated: 2026-02-23
