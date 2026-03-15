import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyBgz19DLl8vtwYtOT2LFbPg5rOAzbZLKpg",
  authDomain: "studio-7038936088-ac3f2.firebaseapp.com",
  projectId: "studio-7038936088-ac3f2",
  storageBucket: "studio-7038936088-ac3f2.firebasestorage.app",
  messagingSenderId: "28439372637",
  appId: "1:28439372637:web:dc7d3a159a16b95b157eb4"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
