'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { USER_ID } from '@/lib/constants';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
}

// Mock user para uso local persistente
const LOCAL_USER = {
  uid: USER_ID,
  displayName: 'Usuario Local',
  email: 'local@cocinafamilia.com',
  photoURL: ''
};

export interface FirebaseContextState {
  areServicesAvailable: boolean;
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  storage: FirebaseStorage | null;
  user: any | null;
}

export interface FirebaseServicesAndUser {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  storage: FirebaseStorage;
  user: any;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
}) => {
  const contextValue = useMemo((): FirebaseContextState => {
    return {
      areServicesAvailable: true,
      firebaseApp,
      firestore,
      storage: getStorage(firebaseApp),
      user: LOCAL_USER,
    };
  }, [firebaseApp, firestore]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return {
    firebaseApp: context.firebaseApp!,
    firestore: context.firestore!,
    storage: context.storage!,
    user: context.user,
  };
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

export const useStorage = (): FirebaseStorage => {
  const { storage } = useFirebase();
  return storage;
};

export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  return memoized;
}

export const useUser = () => {
  return { user: LOCAL_USER, isUserLoading: false, userError: null };
};
