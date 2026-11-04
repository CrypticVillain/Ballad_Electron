import { BookOpenIcon, BugIcon, FlameIcon, GemIcon, LandmarkIcon, LanguagesIcon, LightbulbIcon, SparklesIcon, UsersRoundIcon, type LucideIcon } from 'lucide-react';
import type { LoreType } from './model';

/**
 * Each lore type's name, the fields it starts with (its spec sheet), and
 * what to write about it. Fields are a start: rename, remove or add any.
 */
export type LoreTypeInfo = { label: string; plural: string; icon: LucideIcon; fields: string[]; about: string; tagline: string };

export const LORE_TYPE_INFO: Record<LoreType, LoreTypeInfo> = {
  general: { label: 'Lore', plural: 'General Lore', icon: BookOpenIcon, fields: ['Category', 'Known To'], about: 'What it is, and why it matters to the story…', tagline: 'One line about it' },
  magic: {
    label: 'Magic System',
    plural: 'Magic',
    icon: SparklesIcon,
    fields: ['Source', 'Who Can Use It', 'How It’s Learned', 'Cost', 'Limits', 'Known To'],
    about: 'How it works, what it can’t do, and what it costs the people who use it…',
    tagline: 'One line: what the magic is',
  },
  species: { label: 'Species', plural: 'Species', icon: BugIcon, fields: ['Appearance', 'Lifespan', 'Habitat', 'Diet', 'Society', 'Abilities'], about: 'What they’re like, how they live, how others see them…', tagline: 'One line: what they are' },
  culture: { label: 'Culture', plural: 'Cultures', icon: UsersRoundIcon, fields: ['Homeland', 'Language', 'Values', 'Customs', 'Dress', 'Food'], about: 'What they believe, how they live, what they celebrate and forbid…', tagline: 'One line: who they are' },
  item: { label: 'Item', plural: 'Items', icon: GemIcon, fields: ['Kind', 'Made By', 'Material', 'What It Does', 'Where It Is', 'Owner'], about: 'What it is, where it came from, and why people want it…', tagline: 'One line: what it is' },
  organization: {
    label: 'Organization',
    plural: 'Organizations',
    icon: LandmarkIcon,
    fields: ['Kind', 'Leader', 'Seat', 'Members', 'Goals', 'Rivals'],
    about: 'A government, a guild, an order, a cult: how it’s run, what it wants, what it hides…',
    tagline: 'One line: what it is',
  },
  religion: { label: 'Religion', plural: 'Religions', icon: FlameIcon, fields: ['Deities', 'Clergy', 'Holy Places', 'Rites', 'Holy Days', 'Taboos'], about: 'What its faithful believe, how they worship, what they fear…', tagline: 'One line: what it holds' },
  philosophy: { label: 'Philosophy', plural: 'Philosophies', icon: LightbulbIcon, fields: ['Core Idea', 'Founder', 'Followers', 'Practices', 'Opposed By'], about: 'The idea, who holds it, and how it shapes what they do…', tagline: 'One line: the idea' },
  language: { label: 'Language', plural: 'Languages', icon: LanguagesIcon, fields: ['Spoken By', 'Script', 'Sounds', 'Word Order', 'Sample Phrase'], about: 'Where it’s spoken, how it sounds, how it changed…', tagline: 'One line: who speaks it' },
};
