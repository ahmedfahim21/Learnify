// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage"
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDBBp9pqpBiiHn8LJxQLGwSu62-MLZ5zIc",
  authDomain: "learnify-21625.firebaseapp.com",
  projectId: "learnify-21625",
  storageBucket: "learnify-21625.appspot.com",
  messagingSenderId: "302626873059",
  appId: "1:302626873059:web:b0be601f1eccdcae7b2fd6",
  measurementId: "G-JQNHQH5ZZV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const storage = getStorage(app);


export {storage, app, analytics, db};