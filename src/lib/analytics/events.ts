// Full event taxonomy from the plan's "Instrumentation" section, typed so a
// call site can't accidentally add a stray property (email, display name,
// bio, comment body are never allowed here — enforced by these signatures
// only having the fields the plan lists).
import { track } from './posthog'

type StorySource = 'feed' | 'search' | 'tag' | 'profile' | 'notification' | 'direct'
type OAuthProviderOrLocal = 'google' | 'discord' | 'local' | 'magiclink'

export const analytics = {
  // ---- Signup & activation ----
  signupStarted: (provider: OAuthProviderOrLocal) => track('signup_started', { provider }),
  signupCompleted: (provider: OAuthProviderOrLocal) => track('signup_completed', { provider }),
  onboardingStepCompleted: (step: string, index: number) =>
    track('onboarding_step_completed', { step, index }),
  onboardingCompleted: (genresCount: number) => track('onboarding_completed', { genres_count: genresCount }),
  signinCompleted: (provider: OAuthProviderOrLocal) => track('signin_completed', { provider }),

  // ---- The auth wall ----
  authPromptShown: (action: string) => track('auth_prompt_shown', { action }),
  authPromptConverted: (action: string, provider: OAuthProviderOrLocal) =>
    track('auth_prompt_converted', { action, provider }),
  authPromptDismissed: (action: string) => track('auth_prompt_dismissed', { action }),

  // ---- Discovery ----
  feedViewed: (tab: string, itemsReturned: number) => track('feed_viewed', { tab, items_returned: itemsReturned }),
  searchPerformed: (query: string, resultsCount: number) =>
    // Query text is logged deliberately — see the plan: knowing what people
    // look for and fail to find is worth more than the small risk of odd
    // free text landing in a property.
    track('search_performed', { query, results_count: resultsCount }),
  searchResultClicked: (position: number, resultsCount: number) =>
    track('search_result_clicked', { position, results_count: resultsCount }),
  tagViewed: (tagSlug: string) => track('tag_viewed', { tag_slug: tagSlug }),
  storyViewed: (storyId: string, source: StorySource) => track('story_viewed', { story_id: storyId, source }),

  // ---- The reading loop ----
  chapterOpened: (storyId: string, chapterId: string, chapterNumber: number, source: string) =>
    track('chapter_opened', { story_id: storyId, chapter_id: chapterId, chapter_number: chapterNumber, source }),
  chapterCompleted: (storyId: string, chapterId: string, chapterNumber: number, dwellSeconds: number) =>
    track('chapter_completed', {
      story_id: storyId,
      chapter_id: chapterId,
      chapter_number: chapterNumber,
      dwell_seconds: dwellSeconds,
    }),
  readingResumed: (storyId: string, from: 'library' | 'now_reading_bar') =>
    track('reading_resumed', { story_id: storyId, from }),

  // ---- Engagement ----
  storyLiked: (storyId: string) => track('story_liked', { story_id: storyId }),
  storyUnliked: (storyId: string) => track('story_unliked', { story_id: storyId }),
  storyFollowed: (storyId: string) => track('story_followed', { story_id: storyId }),
  storyUnfollowed: (storyId: string) => track('story_unfollowed', { story_id: storyId }),
  authorFollowed: (authorId: string) => track('author_followed', { author_id: authorId }),
  authorUnfollowed: (authorId: string) => track('author_unfollowed', { author_id: authorId }),
  paragraphLiked: (storyId: string, chapterId: string) =>
    track('paragraph_liked', { story_id: storyId, chapter_id: chapterId }),
  commentPosted: (opts: {
    storyId: string
    chapterId: string
    isReply: boolean
    isParagraphAnchored: boolean
    bodyLength: number
  }) =>
    track('comment_posted', {
      story_id: opts.storyId,
      chapter_id: opts.chapterId,
      is_reply: opts.isReply,
      is_paragraph_anchored: opts.isParagraphAnchored,
      body_length: opts.bodyLength,
    }),
  notificationOpened: (type: string) => track('notification_opened', { type }),
  contentReported: (targetType: string, reason: string) =>
    track('content_reported', { target_type: targetType, reason }),

  // ---- Authoring ----
  storyCreated: () => track('story_created'),
  chapterCreated: (storyId: string) => track('chapter_created', { story_id: storyId }),
  draftSaved: (chapterId: string, wordCount: number) =>
    track('draft_saved', { chapter_id: chapterId, word_count: wordCount }),
  chapterPublished: (opts: {
    storyId: string
    chapterId: string
    chapterNumber: number
    wordCount: number
    wasScheduled: boolean
  }) =>
    track('chapter_published', {
      story_id: opts.storyId,
      chapter_id: opts.chapterId,
      chapter_number: opts.chapterNumber,
      word_count: opts.wordCount,
      was_scheduled: opts.wasScheduled,
    }),
  chapterScheduled: (chapterId: string, leadTimeHours: number) =>
    track('chapter_scheduled', { chapter_id: chapterId, lead_time_hours: leadTimeHours }),
  chapterHidden: (chapterId: string) => track('chapter_hidden', { chapter_id: chapterId }),
  analyticsViewed: (storyId: string) => track('analytics_viewed', { story_id: storyId }),
}
