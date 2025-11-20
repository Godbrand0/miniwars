// Mock implementation for React Native Async Storage in web environment
const storage = {};

export default {
  getItem: async (key) => {
    return storage[key] || null;
  },
  setItem: async (key, value) => {
    storage[key] = value;
  },
  removeItem: async (key) => {
    delete storage[key];
  },
  clear: async () => {
    Object.keys(storage).forEach(key => delete storage[key]);
  }
};