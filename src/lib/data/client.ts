import type {
  AccountId,
  AuthoredComment,
  Chapter,
  ChapterCommentCounts,
  ChapterState,
  Comment,
  CommentReply,
  InProgressRead,
  Notification,
  Page,
  PageParams,
  Profile,
  ReadingProgress,
  ReadingStats,
  Story,
  StoryAnalytics,
  StudioChapter,
  StudioStory,
} from './types'

/**
 * The data-access contract. Every concrete backend (local, supabase, …)
 * implements this same surface — hooks are written once, against this
 * interface, via TanStack Query.
 */
export interface DataClient {
  stories: {
    /** Discover / following feed, most-recently-updated first. */
    feed(params: PageParams & { following?: string[] }): Promise<Page<Story>>
    getBySlug(slug: string): Promise<Story | null>
    /** Looked up by the short random `publicId` used in reader-facing URLs (`/s/:publicId`, `/read/:publicId/...`). */
    getById(publicId: string): Promise<Story | null>
    byTag(tag: string, params?: PageParams): Promise<Page<Story>>
    search(query: string, params?: PageParams): Promise<Page<Story>>
    allTags(): Promise<{ tag: string; count: number }[]>
    /**
     * Real per-story analytics (reads, likes, comments, subscribers,
     * completion rate, a 30-day trend, and top-liked passages), aggregated
     * from actual reading/social data — never hash-fabricated. Author-only:
     * resolves to `null` for a story that doesn't exist or isn't owned by
     * the caller, mirroring the `T | null` convention elsewhere in this
     * interface rather than throwing.
     */
    getAnalytics(slug: string): Promise<StoryAnalytics | null>
  }

  chapters: {
    get(slug: string, number: number): Promise<Chapter | null>
  }

  comments: {
    list(anchor: string, params?: PageParams): Promise<Page<Comment>>
    count(anchor: string): Promise<number>
    countsForChapter(slug: string, chapterNumber: number): Promise<ChapterCommentCounts>
    /** Every comment/reply authored by `handle`, newest first. */
    mine(handle: string, params?: PageParams): Promise<Page<AuthoredComment>>
    add(anchor: string, body: string): Promise<Comment>
    reply(commentId: string, body: string): Promise<CommentReply>
  }

  likes: {
    story: {
      has(slug: string): Promise<boolean>
      toggle(slug: string): Promise<boolean>
      mine(): Promise<string[]>
    }
    paragraph: {
      has(anchor: string): Promise<boolean>
      baseCount(anchor: string): Promise<number>
      toggle(anchor: string): Promise<boolean>
      /** liked + total-like-count for every paragraph anchor in one chapter. */
      forChapter(
        slug: string,
        chapterNumber: number,
      ): Promise<Record<number, { liked: boolean; total: number }>>
      /** Every paragraph anchor the caller has liked, across all stories (for the profile activity feed). */
      mine(): Promise<string[]>
    }
  }

  follows: {
    story: {
      isFollowing(slug: string): Promise<boolean>
      toggle(slug: string): Promise<boolean>
    }
    author: {
      isFollowing(handle: string): Promise<boolean>
      toggle(handle: string): Promise<boolean>
      mine(): Promise<string[]>
    }
  }

  reading: {
    getProgress(storyId: string): Promise<ReadingProgress | null>
    /** Every story with in-progress reading, most recently active first. */
    inProgress(params?: PageParams): Promise<Page<InProgressRead>>
    startChapter(storyId: string, chapterNumber: number): Promise<ReadingProgress>
    completeChapter(storyId: string, chapterNumber: number): Promise<ReadingProgress>
    dismiss(storyId: string): Promise<void>
  }

  notifications: {
    list(params?: PageParams): Promise<Page<Notification>>
    unreadCount(): Promise<number>
    markRead(id: string): Promise<void>
    markAllRead(): Promise<void>
  }

  studio: {
    listMine(): Promise<StudioStory[]>
    getBySlug(slug: string): Promise<StudioStory | null>
    createStory(): Promise<string>
    updateStory(slug: string, patch: Partial<StudioStory>): Promise<void>
    addChapter(slug: string): Promise<string>
    updateChapter(slug: string, chapterId: string, patch: Partial<StudioChapter>): Promise<void>
    setChapterState(slug: string, chapterId: string, state: ChapterState): Promise<void>
    scheduleChapter(slug: string, chapterId: string, at: number): Promise<void>
    setPaywall(slug: string, chapterId: string, locked: boolean): Promise<void>
    deleteChapter(slug: string, chapterId: string): Promise<void>
  }

  profiles: {
    getByHandle(handle: string): Promise<Profile | null>
    getMe(): Promise<Profile>
    updateMe(patch: Partial<Profile>): Promise<Profile>
    getStats(handle: string): Promise<ReadingStats>
    /** The signed-in user's own stats — the only ones that are writable. */
    getMyStats(): Promise<ReadingStats>
    updateMyStats(patch: Partial<ReadingStats>): Promise<ReadingStats>
  }

  auth: {
    getAccountId(): Promise<AccountId>
    switchAccount(id: AccountId): Promise<void>
  }
}
