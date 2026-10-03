const values = new Map<string, string>();

const AsyncStorage = {
  async getItem(key: string) {
    return values.has(key) ? values.get(key)! : null;
  },
  async setItem(key: string, value: string) {
    values.set(key, value);
  },
  async removeItem(key: string) {
    values.delete(key);
  },
  async clear() {
    values.clear();
  },
};

export default AsyncStorage;
