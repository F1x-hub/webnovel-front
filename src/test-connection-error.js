// Test script to simulate ERR_CONNECTION_CLOSED error
// Add this to your index.html or run it in the browser console

setTimeout(() => {
  console.error('Testing error detection: ERR_CONNECTION_CLOSED');
}, 3000);

// You can also test by throwing an error with the pattern
// setTimeout(() => {
//   throw new Error('Network error: ERR_CONNECTION_CLOSED');
// }, 5000);

// Or you can test with a rejected promise
// setTimeout(() => {
//   Promise.reject(new Error('Fetch failed: ERR_CONNECTION_CLOSED'));
// }, 7000); 