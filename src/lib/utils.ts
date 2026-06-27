import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const isStorageAvailable = (): boolean => {
  try {
    const key = "__test_storage_avail__";
    window.localStorage.setItem(key, key);
    window.localStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
};

const memoryStorage: Record<string, string> = {};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (isStorageAvailable()) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn("Storage access denied. Falling back to memory storage.", e);
    }
    return memoryStorage[key] !== undefined ? memoryStorage[key] : null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (isStorageAvailable()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn("Storage access denied. Saving to memory instead.", e);
    }
    memoryStorage[key] = value;
  },
  removeItem: (key: string): void => {
    try {
      if (isStorageAvailable()) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn("Storage access denied. Removing from memory instead.", e);
    }
    delete memoryStorage[key];
  }
};

const isSessionStorageAvailable = (): boolean => {
  try {
    const key = "__test_session_storage_avail__";
    window.sessionStorage.setItem(key, key);
    window.sessionStorage.removeItem(key);
    return true;
  } catch (e) {
    return false;
  }
};

const memorySessionStorage: Record<string, string> = {};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (isSessionStorageAvailable()) {
        return window.sessionStorage.getItem(key);
      }
    } catch (e) {
      console.warn("SessionStorage access denied. Falling back to memory storage.", e);
    }
    return memorySessionStorage[key] !== undefined ? memorySessionStorage[key] : null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (isSessionStorageAvailable()) {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn("SessionStorage access denied. Saving to memory instead.", e);
    }
    memorySessionStorage[key] = value;
  },
  removeItem: (key: string): void => {
    try {
      if (isSessionStorageAvailable()) {
        window.sessionStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn("SessionStorage access denied. Removing from memory instead.", e);
    }
    delete memorySessionStorage[key];
  }
};
