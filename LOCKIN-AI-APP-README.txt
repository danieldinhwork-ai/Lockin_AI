LOCKIN.AI APP PACKAGE

This is the actual LOCKIN.AI application source, not Freebuff.

WHAT IS INCLUDED
- client/src: React application pages and components
- server: Express API, authentication, database, coach and routes
- android-app: Android WebView app source
- render.yaml: Render deployment configuration
- package.json: build and start scripts

HOW TO RUN LOCALLY
1. Install Node.js 18 or newer.
2. Run: npm install
3. Run: npm run build
4. Run: npm start
5. Open: http://localhost:4000

HOW TO DEPLOY
Upload the contents of this package to a GitHub repository, then create a Render Blueprint from render.yaml. Render will build the React app and start the Express API. A persistent disk is required for the SQLite database.

IMPORTANT
The marketing website is separate. This package is the real app with login, dashboard, quests, workouts, nutrition, learning, coach, shop and database-backed features.
