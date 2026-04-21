//GOOGLE APPS SCRIPT URL
const API_BASE = 'https://script.google.com/macros/s/AKfycbwIu2q7ORDVxAJlMuqnsiSamrY0sQhqS9d012rl162lJrsGoIhgZxzT41XfGVWjnk2dNg/exec';

// Cohort start date (YYYY-MM-DD)
const COHORT_START = '2026-04-21';

// Current student (set after login)
let currentStudent = {
    code: null,
    name: null
};