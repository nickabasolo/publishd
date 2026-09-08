import { useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAccount } from '@/context/account'
import { useDataClient } from '@/lib/data'
import { ACCOUNTS } from '@/data/accounts'
import type { Profile, ReadingStats } from '@/lib/data'
import type { AuthorProfile, FakeStats, User } from '@/lib/types'

function profileToUser(p: Profile): User {
  return {
    id: p.id,
    username: p.handle,
    displayName: p.displayName,
    avatarColor: p.avatarColor,
    bio: p.bio,
    favoriteGenres: p.favoriteGenres,
    author: p.author as AuthorProfile | undefined,
  }
}

// Identity + stats are per fake account, so switching accounts in the banner
// swaps who "you" are everywhere useUser is consumed.
export function useUser() {
  const client = useDataClient()
  const qc = useQueryClient()
  const { accountId } = useAccount()
  const key = ['profiles', 'me', accountId] as const

  const query = useQuery({
    queryKey: key,
    queryFn: () => client.profiles.getMe(),
    // The local adapter's default for this account, so there's no loading
    // flash while the (effectively instant) local fetch resolves.
    placeholderData: () => profileToUser(ACCOUNTS[accountId].user as unknown as Profile) as unknown as Profile,
  })

  const user: User = query.data ? profileToUser(query.data) : ACCOUNTS[accountId].user

  const mutation = useMutation({
    mutationFn: (partial: Partial<User>) =>
      client.profiles.updateMe({
        displayName: partial.displayName,
        handle: partial.username,
        avatarColor: partial.avatarColor,
        bio: partial.bio,
        favoriteGenres: partial.favoriteGenres,
      }),
    onMutate: async (partial) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Profile>(key)
      if (prev) {
        qc.setQueryData<Profile>(key, {
          ...prev,
          displayName: partial.displayName ?? prev.displayName,
          handle: partial.username ?? prev.handle,
          avatarColor: partial.avatarColor ?? prev.avatarColor,
          bio: partial.bio ?? prev.bio,
          favoriteGenres: partial.favoriteGenres ?? prev.favoriteGenres,
        })
      }
      return { prev }
    },
    onError: (_err, _partial, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: (profile) => qc.setQueryData(key, profile),
  })

  const updateUser = useCallback((partial: Partial<User>) => mutation.mutate(partial), [mutation])
  return { user, updateUser }
}

// Faked reading stats, tunable from Settings for demos. Not computed from anything.
export function useFakeStats() {
  const client = useDataClient()
  const qc = useQueryClient()
  const { accountId } = useAccount()
  const key = ['profiles', 'myStats', accountId] as const

  const query = useQuery({
    queryKey: key,
    queryFn: () => client.profiles.getMyStats(),
    placeholderData: () => ACCOUNTS[accountId].stats as unknown as ReadingStats,
  })

  const stats: FakeStats = query.data ?? ACCOUNTS[accountId].stats

  const mutation = useMutation({
    mutationFn: (partial: Partial<FakeStats>) => client.profiles.updateMyStats(partial),
    onMutate: async (partial) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<ReadingStats>(key)
      if (prev) qc.setQueryData<ReadingStats>(key, { ...prev, ...partial })
      return { prev }
    },
    onError: (_err, _partial, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: (next) => qc.setQueryData(key, next),
  })

  const updateStats = useCallback((partial: Partial<FakeStats>) => mutation.mutate(partial), [mutation])
  return { stats, updateStats }
}
