import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const parent = await getDoc(doc(db, 'stockTabs', '9FsExvpLj3MBI1mnDZvP'));
    console.log("Parent exists?", parent.exists());
    if (parent.exists()) {
      console.log("Parent userId:", parent.data().userId);
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

check();
