import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase 설정 (실제 프로젝트에서 Firebase 콘솔에서 가져와야 함)
const firebaseConfig = {
  apiKey: "AIzaSyCvFKkpxhRSclRN4ekqNNU8ptc8MAhVUpg",
  authDomain: "know-quiz-147d4.firebaseapp.com",
  projectId: "know-quiz-147d4",
  storageBucket: "know-quiz-147d4.firebasestorage.app",
  messagingSenderId: "603124214540",
  appId: "1:603124214540:web:423981bc638d73e627b729"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Firebase 서비스 초기화
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app; 