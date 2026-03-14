export const testSets = [
  { name: 'Test Set Alpha', description: 'First test set for automated testing' },
  { name: 'Test Set Beta', description: 'Second test set for automated testing' },
  { name: 'Test Set Gamma', description: 'Third test set with no songs' },
] as const;

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
