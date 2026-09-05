import { initializeApp } from 'firebase/app';
import { 
  getAuth,
  initializeAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  inMemoryPersistence,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// Suppress non-critical internal network latency / offline mode warnings from Firestore SDK
try {
  setLogLevel('error');
} catch (e) {
  // Ignore in case setLogLevel is restricted
}

// Initialize Firestore with robust multi-tab persistent IndexedDB cache & forced long-polling for iframe/proxy reliability
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch (e) {
  console.warn("initializeFirestore with persistentLocalCache fallback:", e);
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;

// Initial connection test as recommended by Firebase integration guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('offline') || error.message.includes('unavailable'))) {
      console.info("[Firestore Connection Status] Firestore client operates with local cache persistence.");
    }
  }
}
testConnection();

// Initialize Firebase Auth with multiple persistence targets to prevent WKWebView/Chrome iOS sandboxed storage crashes.
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch (e) {
  console.warn("initializeAuth failed, falling back to standard getAuth:", e);
  authInstance = getAuth(app);
}

export const auth = authInstance;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function isFirestoreOfflineError(error: unknown): boolean {
  if (!error) return false;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('offline') ||
    msg.includes('client is offline') ||
    msg.includes('unavailable') ||
    msg.includes('could not reach') ||
    msg.includes('backend didn\'t respond') ||
    msg.includes('failed-precondition') ||
    msg.includes('deadline-exceeded') ||
    msg.includes('network-request-failed') ||
    msg.includes('timed out')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Gracefully handle transient offline / connection latency without throwing unhandled exceptions
  if (isFirestoreOfflineError(error)) {
    console.warn(`[Firestore Offline Cache Active] Operation ${operationType} on path '${path}': ${errorMessage}`);
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
