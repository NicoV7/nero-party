import type { SVGProps } from 'react';

type ReactionIconProps = SVGProps<SVGSVGElement>;

const iconClass = 'h-5 w-5';

const FireIcon = (props: ReactionIconProps) => (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
  </svg>
);

const HeartIcon = (props: ReactionIconProps) => (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
  </svg>
);

const SleepIcon = (props: ReactionIconProps) => (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
  </svg>
);

const SparkleIcon = (props: ReactionIconProps) => (
  <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

export const QUICK_REACTIONS = [
  { key: 'fire', icon: FireIcon, label: 'Fire', reaction: 'fire', score: '+3' },
  { key: 'heart', icon: HeartIcon, label: 'Love', reaction: 'heart', score: '+2' },
  { key: 'sleep', icon: SleepIcon, label: 'Meh', reaction: 'meh', score: '0' },
  { key: 'thumbsdown', icon: SparkleIcon, label: 'Pass', reaction: 'thumbsdown', score: '-1' },
] as const;

export type QuickReaction = (typeof QUICK_REACTIONS)[number];

export function getQuickReaction(key: string) {
  return QUICK_REACTIONS.find((reaction) => reaction.key === key || reaction.reaction === key);
}
