// js/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDd3jR4aoKDFQYeNxU-X2Spb_dDYTWu5Yo",
  authDomain: "whale-city-archive.firebaseapp.com",
  projectId: "whale-city-archive",
  storageBucket: "whale-city-archive.firebasestorage.app",
  messagingSenderId: "571804465771",
  appId: "1:571804465771:web:41b357ffd4dd9b9427cf2e",
  measurementId: "G-8KG4JCB8TX"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    useFetchStreams: false,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  },
  "default"
);

console.log("Firebase 연결 완료");

export {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  collection,
  addDoc,
  doc,
  setDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
};