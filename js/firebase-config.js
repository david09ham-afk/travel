import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

// Firebase 웹 설정은 브라우저에 공개되는 값입니다. Admin SDK 비밀 키는 여기에 넣지 마세요.
const firebaseConfig = {
  apiKey: "AIzaSyBhZljsrxBRJfF053K3IEx5y2lG5Uqjtrw",
  authDomain: "travel-30c1b.firebaseapp.com",
  projectId: "travel-30c1b",
  storageBucket: "travel-30c1b.firebasestorage.app",
  messagingSenderId: "123741134794",
  appId: "1:123741134794:web:51c61367f1acaeff78b933",
  databaseURL: "https://travel-30c1b-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);
