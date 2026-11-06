import { BookOpenIcon, FlagIcon, GemIcon, ListChecksIcon, MapPinIcon, SearchIcon, StickyNoteIcon, UserRoundIcon, type LucideIcon } from 'lucide-react';
import type { NoteCategory } from '@/lib/model';

/** A Tabletop note's categories: what each is called, its icon, and what the note's checklist is for. */
export const NOTE_INFO: Record<NoteCategory, { label: string; plural: string; icon: LucideIcon; checklist: string; placeholder: string }> = {
  general: { label: 'Note', plural: 'Notes', icon: StickyNoteIcon, checklist: 'Checklist', placeholder: 'Anything worth remembering…' },
  quest: { label: 'Quest', plural: 'Quests', icon: FlagIcon, checklist: 'Objectives', placeholder: 'Who asked, what for, and the reward…' },
  npc: { label: 'Person', plural: 'People', icon: UserRoundIcon, checklist: 'To Ask Them', placeholder: 'Who they are, what they want, what they owe you…' },
  place: { label: 'Place', plural: 'Places', icon: MapPinIcon, checklist: 'To Explore', placeholder: 'How to get there, who runs it, what’s inside…' },
  clue: { label: 'Clue', plural: 'Clues', icon: SearchIcon, checklist: 'Leads', placeholder: 'What you found, and what it might mean…' },
  loot: { label: 'Loot', plural: 'Loot', icon: GemIcon, checklist: 'To Split Or Sell', placeholder: 'What you found, where, and who took it…' },
  lore: { label: 'Lore', plural: 'Lore', icon: BookOpenIcon, checklist: 'Questions', placeholder: 'Legends, gods, history, rumors…' },
  todo: { label: 'To-Do', plural: 'To-Dos', icon: ListChecksIcon, checklist: 'To-Do', placeholder: 'Things to do between sessions…' },
};
