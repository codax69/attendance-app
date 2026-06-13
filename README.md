# Attendance App

A Node.js/Express application for managing attendance using MongoDB.

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables Setup

Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Then update the `.env` file with your actual values:
- **PORT**: Server port (default: 3000)
- **DB_URI**: MongoDB connection string (Atlas or Local)
- **ACCESS_TOKEN_SECRET**: Secret key for access tokens
- **REFRESH_TOKEN_SECRET**: Secret key for refresh tokens
- **ACCESS_TOKEN_EXPIRY**: Access token expiration time (default: 1d)
- **REFRESH_TOKEN_EXPIRY**: Refresh token expiration time (default: 10d)
- **FORCE_GOOGLE_DNS**: Set to "true" to use Google DNS (optional)

### 3. MongoDB Atlas Setup (if using cloud database)

1. Create a cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a database user with read/write access
3. Get the connection string and update `DB_URI` in `.env`

### 4. Run the Application

**Development Mode** (with auto-reload):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server listening port | 3000 |
| DB_URI | MongoDB connection URI | Required |
| ACCESS_TOKEN_SECRET | Secret for JWT access tokens | Required |
| REFRESH_TOKEN_SECRET | Secret for JWT refresh tokens | Required |
| ACCESS_TOKEN_EXPIRY | Access token TTL | 1d |
| REFRESH_TOKEN_EXPIRY | Refresh token TTL | 10d |
| FORCE_GOOGLE_DNS | Use Google DNS servers | false |

## Project Structure

```
src/
├── controller/       # Request handlers
├── db/              # Database connection
├── middleware/      # Express middleware
├── models/          # Mongoose schemas
├── routes/          # API routes
├── utils/           # Helper utilities
├── app.js           # Express app configuration
├── constant.js      # Application constants
└── index.js         # Application entry point
```

## Security Notes

- **Never commit `.env` file** - it's in `.gitignore`
- Use strong, unique secrets for TOKEN_SECRET variables
- For production, use environment-specific `.env` files or CI/CD secrets
- Keep sensitive credentials out of version control

## Default Classes

The application automatically seeds these classes on first run:
- Information Technology (IT)
- Computer Engineering (CO)
- Mechanical Engineering (ME)
- Electrical Engineering (EE)
- Civil Engineering (CE)
- Electronics & Communication (EC)
