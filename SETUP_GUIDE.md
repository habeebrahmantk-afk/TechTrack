# Field Tracker — Setup Guide
## Follow these steps in order. Takes about 1 hour. Everything is FREE.

---

## STAGE 1 — Create 3 free accounts (15 min)

### 1a. Firebase (Google) — your database
1. Go to **https://firebase.google.com**
2. Click **"Get started"** (top right)
3. Sign in with your Gmail account
4. You are now in the Firebase Console ✓

### 1b. GitHub — stores your code
1. Go to **https://github.com**
2. Click **"Sign up"** (top right)
3. Enter your email, create a password, choose a username
4. Verify your email when prompted ✓

### 1c. Vercel — hosts your app online
1. Go to **https://vercel.com**
2. Click **"Sign Up"**
3. Choose **"Continue with GitHub"**
4. Allow Vercel to access your GitHub ✓

---

## STAGE 2 — Set up Firebase database (15 min)

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name it **field-tracker** → click Continue
4. Turn OFF Google Analytics (not needed) → click **"Create project"**
5. Wait for it to create → click **"Continue"**

### Create the database:
6. In the left menu, click **"Firestore Database"**
7. Click **"Create database"**
8. Choose **"Start in production mode"** → click Next
9. Choose any location near you → click **"Enable"**

### Set database rules (allow your app to read/write):
10. Click the **"Rules"** tab
11. Delete everything and paste this instead:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
12. Click **"Publish"**

### Get your config keys:
13. Click the **gear icon** (⚙️) next to "Project Overview" → **"Project settings"**
14. Scroll down to **"Your apps"** → click the **"</>"** (Web) button
15. Name it **field-tracker-web** → click **"Register app"**
16. You will see a block of code like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "field-tracker-xxxxx.firebaseapp.com",
  projectId: "field-tracker-xxxxx",
  storageBucket: "field-tracker-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```
17. **Copy all 6 values** — you will need them in Stage 3 ✓

---

## STAGE 3 — Put your Firebase keys in the code (5 min)

1. Open the file **`src/firebase.js`** from the files I gave you
2. Replace each "PASTE_YOUR_..." with your actual values from Step 17 above
3. Save the file

Example (your values will be different):
```javascript
const firebaseConfig = {
  apiKey:            "AIzaSyABC123...",
  authDomain:        "field-tracker-12345.firebaseapp.com",
  projectId:         "field-tracker-12345",
  storageBucket:     "field-tracker-12345.appspot.com",
  messagingSenderId: "987654321",
  appId:             "1:987654321:web:xyz123"
}
```

---

## STAGE 4 — Upload files to GitHub (10 min)

1. Go to **https://github.com** and sign in
2. Click **"+"** (top right) → **"New repository"**
3. Name it **field-tracker**
4. Make sure it says **"Public"**
5. Check **"Add a README file"**
6. Click **"Create repository"**

### Upload the files:
7. Click **"Add file"** → **"Upload files"**
8. Drag ALL the files and folders I gave you into the upload box:
   - `package.json`
   - `vite.config.js`
   - `index.html`
   - The `src/` folder (with `main.jsx`, `App.jsx`, `firebase.js`)
   - The `public/` folder
9. Scroll down → click **"Commit changes"**
10. Wait for upload to finish ✓

---

## STAGE 5 — Deploy on Vercel (5 min)

1. Go to **https://vercel.com** and sign in
2. Click **"Add New..."** → **"Project"**
3. You will see your **field-tracker** GitHub repository listed
4. Click **"Import"** next to it
5. Vercel auto-detects it's a Vite app — no changes needed
6. Click **"Deploy"**
7. Wait 1-2 minutes ⏳
8. 🎉 **Your app is live!** Vercel gives you a URL like:
   `https://field-tracker-yourname.vercel.app`

---

## STAGE 6 — Install on iPhone and Android (2 min)

### iPhone (Safari):
1. Open your Vercel URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share button** (box with arrow pointing up)
3. Scroll down → tap **"Add to Home Screen"**
4. Name it "Field Tracker" → tap **"Add"**
5. App icon appears on your home screen ✓

### Android (Chrome):
1. Open your Vercel URL in **Chrome**
2. Tap the **3-dot menu** (top right)
3. Tap **"Add to Home screen"** or **"Install app"**
4. Confirm → App icon appears on your home screen ✓

---

## You're done! 🎉

Share the Vercel URL with your engineers and technicians.
Everyone opens it on their phone and adds it to their home screen.

**First login:**
- The first time anyone opens the app, it asks you to create the Manager account
- After that, go to Accounts tab to create engineer and technician accounts
- Share each person's username + password with them directly

---

## Help & Troubleshooting

**App won't load?**
→ Check that your Firebase keys in `src/firebase.js` are correct

**"Permission denied" error?**
→ Go back to Firebase Console → Firestore → Rules → make sure you published the rules from Stage 2

**Forgot a password?**
→ Manager can reset it from the Accounts tab

**Want a custom domain** (e.g. fieldtracker.yourcompany.com)?
→ In Vercel, go to your project → Settings → Domains → add your domain
→ Buy a domain from Namecheap.com (~$10/year)
