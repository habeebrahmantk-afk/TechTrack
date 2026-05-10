// ═══════════════════════════════════════════════════════════════════
//  IMPORTANT — FILL IN YOUR FIREBASE CONFIG HERE
//
//  How to get these values:
//  1. Go to console.firebase.google.com
//  2. Click your project → ⚙️ gear icon → Project Settings
//  3. Scroll down → Your Apps → Web app → Config
//  4. Copy each value and paste below, replacing the PASTE_... text
// ═══════════════════════════════════════════════════════════════════

import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCRaUY2QhnJvHd2RJ5znytE-MYPyyWr5fg",
  authDomain: "techtrack-a313b.firebaseapp.com",
  projectId: "techtrack-a313b",
  storageBucket: "techtrack-a313b.firebasestorage.app",
  messagingSenderId: "637387063980",
  appId: "1:637387063980:web:593eededcdac13dda41509",
  measurementId: "G-BQZXVP0DTQ"
};

// ═══════════════════════════════════════════════════════════════════
//  DO NOT EDIT BELOW THIS LINE
// ═══════════════════════════════════════════════════════════════════
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
