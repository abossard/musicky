export const testPhases = ['opener', 'buildup', 'peak', 'cooldown', 'closer'] as const;

export const testMoods = ['euphoric', 'dark', 'energetic', 'dreamy'] as const;

export const testGenres = ['techno', 'house', 'trance', 'progressive'] as const;

export const searchQueries = {
  valid: ['test', 'song', 'mp3'],
  tooShort: ['a'],
  noResults: ['xyzabc123nonexistent'],
} as const;

export const invalidInputs = {
  empty: '',
  whitespace: '   ',
  veryLong: 'a'.repeat(500),
  xss: '<script>alert("xss")</script>',
  sqlInjection: "'; DROP TABLE dj_sets; --",
} as const;
