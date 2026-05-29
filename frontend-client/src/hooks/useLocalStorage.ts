import React from 'react';

const USER_ID_KEY = 'auction_user_id';
const USER_ID_MIN = 1000;
const USER_ID_MAX = 9999;

function generateRandomUserId(): number {
  return Math.floor(Math.random() * (USER_ID_MAX - USER_ID_MIN + 1)) + USER_ID_MIN;
}

export function getStoredUserId(): number {
  const stored = localStorage.getItem(USER_ID_KEY);
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= USER_ID_MIN && parsed <= USER_ID_MAX) {
      return parsed;
    }
  }
  const newId = generateRandomUserId();
  localStorage.setItem(USER_ID_KEY, String(newId));
  return newId;
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = React.useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}