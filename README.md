# CyberLock Quiz App

A retro pixel-styled quiz application with single-player and multiplayer modes.

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials
4. Set up Firebase security rules (see below)
5. Run the server: `node server.js`

## Firebase Security

⚠️ **Important**: Firebase config is client-side and visible. Secure your database with Firebase Security Rules:
```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

## Environment Variables

See `.env.example` for required variables.
