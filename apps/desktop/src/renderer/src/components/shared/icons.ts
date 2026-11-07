import { createLucideIcon } from 'lucide-react';

/**
 * Icons Lucide doesn't have, drawn on its 24 grid in its stroke style so they
 * sit beside its own (and take className, size, strokeWidth the same way).
 *
 *   SwordShieldIcon   Play: a shield with a sword upright on it, like a crest
 */

export const SwordShieldIcon = createLucideIcon({
  name: 'sword-shield',
  size: 24,
  node: [
    // Lucide's shield.
    ['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', key: 'shield' }],
    // The sword on it: the blade to its point, the crossguard, the grip.
    ['path', { d: 'M10.5 14V8.5L12 6.5l1.5 2V14', key: 'blade' }],
    ['path', { d: 'M8.5 14h7', key: 'guard' }],
    ['path', { d: 'M12 14v4', key: 'grip' }],
  ],
});
