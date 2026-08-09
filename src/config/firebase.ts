import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Web app Firebase configuration dari sdk.txt
const firebaseConfig = {
  apiKey: "AIzaSyBIjgcYcJQTBoIMfBx2nMf6MSc_ggMkOT4",
  authDomain: "dppkb-majene.firebaseapp.com",
  projectId: "dppkb-majene",
  storageBucket: "dppkb-majene.firebasestorage.app",
  messagingSenderId: "95251749922",
  appId: "1:95251749922:web:81e5eb533f1a95f6053e7b"
};

// Inisialisasi Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
