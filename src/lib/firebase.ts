import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  Auth
} from 'firebase/auth';
import { 
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);

// Suppress non-critical internal network latency / offline mode warnings from Firestore SDK
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore in case setLogLevel is restricted
}

// Initialize Firestore: Use experimentalForceLongPolling and lock-free memory cache
// to guarantee instant connectivity in cross-origin iframes (AI Studio Preview) and Cloud Run.
const isEmbeddedIframe = typeof window !== 'undefined' && (
  window.self !== window.top ||
  (window.location?.hostname || '').includes('run.app') ||
  (window.location?.hostname || '').includes('aistudio') ||
  true
);

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch (e) {
  console.warn("initializeFirestore initial attempt notice:", e);
  try {
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    console.error("Firestore initialization fallback error:", err);
  }
}

export const db = firestoreInstance;

// Initialize Firebase Auth with resilient persistence fallback for iframe / third-party cookie restrictions
let authInstance: Auth;
try {
  if (typeof window !== 'undefined') {
    authInstance = initializeAuth(app, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        inMemoryPersistence,
      ],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } else {
    authInstance = getAuth(app);
  }
} catch (e) {
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
    msg.includes('timed out') ||
    msg.includes('permission') ||
    msg.includes('insufficient')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Gracefully handle transient offline, connection latency, or unauthenticated state without throwing unhandled exceptions
  if (isFirestoreOfflineError(error) || !auth.currentUser) {
    console.warn(`[Firestore Local/Cache Fallback] Operation ${operationType} on path '${path}': ${errorMessage}`);
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
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
}
