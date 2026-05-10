# 🛠️ Field Work Tracker

**CCTV · Access Control · Biometrics · Gate Barriers · Digital Signage · Electronic Directories**

---

## What this app does
A field work management system for your maintenance team.
- Manager sees full overview of all sites, clients, engineers and technicians
- Engineers assign tasks to technicians, comment, reassign
- Technicians start tasks, report findings, submit field reports
- Export daily / weekly / monthly reports to Excel or Word
- Works on iPhone and Android (add to home screen)

---

## 📁 File Structure — What Each File Does

```
field-tracker/
│
├── 📄 README.md              ← This file. Keep for reference.
├── 📄 SETUP_GUIDE.md         ← Full step-by-step setup instructions
├── 📄 package.json           ← App dependencies list. DO NOT EDIT.
├── 📄 vite.config.js         ← Build settings. DO NOT EDIT.
├── 📄 index.html             ← App entry page. DO NOT EDIT.
├── 📄 .gitignore             ← Protects your files. DO NOT EDIT.
│
├── 📁 src/
│   ├── 🔑 firebase.js        ← ⚠️ YOUR FIREBASE KEYS GO HERE
│   ├── 📄 App.jsx            ← Full app code. DO NOT EDIT.
│   └── 📄 main.jsx           ← App starter. DO NOT EDIT.
│
└── 📁 public/
    ├── 📄 manifest.json      ← PWA settings. DO NOT EDIT.
    ├── 🖼️ icon-192.png       ← App icon (phone home screen)
    └── 🖼️ icon-512.png       ← App icon (large)
```

---

## ⚠️ The ONLY file you need to edit

**`src/firebase.js`** — paste your 6 Firebase keys here.

Get them from: Firebase Console → Project Settings → Your Apps → Web App → Config

---

## 🚀 Deploy Steps (quick reminder)

1. Fill in `src/firebase.js` with your Firebase keys
2. Upload all files to GitHub repository
3. Connect GitHub repository to Vercel
4. Vercel auto-deploys → you get a live URL
5. Share URL with team → add to phone home screen

---

## 🔐 Login Info

- First person to open the app creates the **Manager** account
- Manager creates all Engineer and Technician accounts from the **Accounts** tab
- Passwords are SHA-256 hashed — cannot be read, only reset by Manager

---

## 📞 If something breaks

1. Check `src/firebase.js` — make sure all 6 values are correct
2. Check Firebase Console → Firestore → Rules → must say `allow read, write: if true`
3. Check Vercel dashboard → Deployments → look for any red errors

---

## 🔄 How to update the app in future

1. Edit the file (e.g. `App.jsx`)
2. Upload the changed file to GitHub (same repository)
3. Vercel automatically re-deploys within 1-2 minutes
4. Your team sees the update immediately — no reinstall needed

---

*Created with Claude AI · Field Tracker v1.0*
