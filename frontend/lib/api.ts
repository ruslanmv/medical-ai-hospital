export const api = {
  base: process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8080',

  async get(path: string) {
    return fetch(this.base + path, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
  },

  async post(path: string, body: any) {
    return fetch(this.base + path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async put(path: string, body: any) {
    return fetch(this.base + path, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};
