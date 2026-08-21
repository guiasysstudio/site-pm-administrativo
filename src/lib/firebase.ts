import { initializeApp } from 'firebase/app';
        import { getAuth } from 'firebase/auth';
        import { getFirestore } from 'firebase/firestore';

        export const firebaseConfig = {
  "apiKey": "AIzaSyCpLXgaUEeNSyUEMKXXTeZcQRB85dvmUv4",
  "authDomain": "site-pm-guiasys.firebaseapp.com",
  "projectId": "site-pm-guiasys",
  "storageBucket": "site-pm-guiasys.firebasestorage.app",
  "messagingSenderId": "487245114742",
  "appId": "1:487245114742:web:3e79e4f0a82d5d0964de57",
  "measurementId": "G-R2WT3Z7HL2"
};

        export const app = initializeApp(firebaseConfig);
        export const auth = getAuth(app);
        export const db = getFirestore(app);
