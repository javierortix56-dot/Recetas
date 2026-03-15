'use client';

import { useEffect, useState } from 'react'
import {
  Query,
  CollectionReference,
  onSnapshot,
  DocumentData,
} from 'firebase/firestore'

/**
 * Hook para suscribirse a una colección o query de Firestore en tiempo real.
 */
export function useCollection<T = DocumentData>(
  query: Query<T> | CollectionReference<T> | null | undefined
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!query) {
      setLoading(false)
      return
    }

    setLoading(true)

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[]
        setData(docs)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error('Firestore error (collection):', err)
        setError(err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [query])

  return { data, loading, error }
}
