/**
 * BloodLink - Centralized API Client Module
 * Provides standardized Fetch API wrappers with JSON parsing and error handling.
 */

// If accessed via file:// or another port (like VS Code Live Server on 5500), route to Express on port 5000
const API_BASE = (window.location.protocol === 'file:' || (window.location.port && window.location.port !== '5000'))
  ? 'http://localhost:5000'
  : '';

const API = {
  async get(url) {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`[API GET Error] ${url}:`, err);
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
        throw new Error("Unable to connect to backend server. Make sure 'npm start' is running and open http://localhost:5000 in your browser.");
      }
      throw err;
    }
  },

  async post(url, payload) {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.errors = data.errors || null;
        throw error;
      }
      return data;
    } catch (err) {
      console.error(`[API POST Error] ${url}:`, err);
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
        throw new Error("Unable to connect to backend server. Make sure 'npm start' is running and open http://localhost:5000 in your browser.");
      }
      throw err;
    }
  },

  async put(url, payload) {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`[API PUT Error] ${url}:`, err);
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
        throw new Error("Unable to connect to backend server. Make sure 'npm start' is running and open http://localhost:5000 in your browser.");
      }
      throw err;
    }
  },

  async delete(url) {
    try {
      const response = await fetch(`${API_BASE}${url}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`[API DELETE Error] ${url}:`, err);
      if (err.name === 'TypeError' && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
        throw new Error("Unable to connect to backend server. Make sure 'npm start' is running and open http://localhost:5000 in your browser.");
      }
      throw err;
    }
  }
};
