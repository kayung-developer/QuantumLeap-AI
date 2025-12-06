import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, EmailAuthProvider } from "firebase/auth";

// IMPORTANT: Replace with your Firebase project's configuration
const firebaseConfig = {
  apiKey: "AIzaSyDH9K6g5_3OMShq5lpc_qZ92HZ6bxdHIro",
  authDomain: "ai-trader-60065.firebaseapp.com",
  projectId: "ai-trader-60065",
  storageBucket: "ai-trader-60065.firebasestorage.app",
  messagingSenderId: "467709271468",
  appId: "1:467709271468:web:46185ef40aab3f81b8ae09",
  measurementId: "G-JS91JB672M"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const emailProvider = new EmailAuthProvider();

export default app;