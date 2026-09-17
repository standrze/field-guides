(() => {
  'use strict';
  // Literal, case-sensitive whole terms. One pass prevents replacements from expanding again.
  function apply(text, entries = []) {
    const rules = new Map();
    for (const entry of entries) {
      if (typeof entry?.term === 'string' && entry.term && typeof entry.spoken === 'string' && entry.spoken) rules.set(entry.term, entry.spoken);
    }
    if (!rules.size) return String(text || '');
    const terms = [...rules.keys()].sort((a, b) => b.length - a.length);
    const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?:${escaped.join('|')})(?![\\p{L}\\p{M}\\p{N}_])`, 'gu');
    return String(text || '').replace(pattern, term => rules.get(term));
  }
  window.FieldGuidePronunciation = Object.freeze({apply});
})();
