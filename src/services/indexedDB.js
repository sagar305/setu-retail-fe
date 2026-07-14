const DB_NAME = 'SetupRetailDB';
const DB_VERSION = 1;

const STORES = {
  products: 'products',
  inventory: 'inventory',
  invoices: 'invoices',
  customers: 'customers',
  syncQueue: 'syncQueue',
};

class IndexedDBService {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Products store
        if (!db.objectStoreNames.contains(STORES.products)) {
          const productStore = db.createObjectStore(STORES.products, { keyPath: '_id' });
          productStore.createIndex('tenantId', 'tenantId', { unique: false });
          productStore.createIndex('sku', 'sku', { unique: true });
        }

        // Inventory store
        if (!db.objectStoreNames.contains(STORES.inventory)) {
          const inventoryStore = db.createObjectStore(STORES.inventory, { keyPath: '_id' });
          inventoryStore.createIndex('tenantId', 'tenantId', { unique: false });
          inventoryStore.createIndex('productId', 'productId', { unique: false });
        }

        // Invoices store
        if (!db.objectStoreNames.contains(STORES.invoices)) {
          const invoiceStore = db.createObjectStore(STORES.invoices, { keyPath: '_id' });
          invoiceStore.createIndex('tenantId', 'tenantId', { unique: false });
          invoiceStore.createIndex('invoiceNumber', 'invoiceNumber', { unique: true });
        }

        // Customers store
        if (!db.objectStoreNames.contains(STORES.customers)) {
          const customerStore = db.createObjectStore(STORES.customers, { keyPath: '_id' });
          customerStore.createIndex('tenantId', 'tenantId', { unique: false });
          customerStore.createIndex('phone', 'phone', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains(STORES.syncQueue)) {
          db.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async addItem(storeName, item) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async putItem(storeName, item) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getItem(storeName, key) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAllItems(storeName) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getItemsByIndex(storeName, indexName, value) {
    const transaction = this.db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(value);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async deleteItem(storeName, key) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async clearStore(storeName) {
    const transaction = this.db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async addToSyncQueue(action) {
    return this.addItem(STORES.syncQueue, {
      ...action,
      timestamp: new Date(),
      synced: false,
    });
  }

  async getSyncQueue() {
    return this.getAllItems(STORES.syncQueue);
  }

  async markSyncQueueItemAsSynced(id) {
    const item = await this.getItem(STORES.syncQueue, id);
    if (item) {
      item.synced = true;
      await this.putItem(STORES.syncQueue, item);
    }
  }

  async clearSyncQueue() {
    return this.clearStore(STORES.syncQueue);
  }

  async saveProducts(tenantId, products) {
    for (const product of products) {
      await this.putItem(STORES.products, {
        ...product,
        tenantId,
        syncedAt: new Date(),
      });
    }
  }

  async saveInventory(tenantId, inventory) {
    for (const item of inventory) {
      await this.putItem(STORES.inventory, {
        ...item,
        tenantId,
        syncedAt: new Date(),
      });
    }
  }

  async saveCustomers(tenantId, customers) {
    for (const customer of customers) {
      await this.putItem(STORES.customers, {
        ...customer,
        tenantId,
        syncedAt: new Date(),
      });
    }
  }

  async saveInvoice(invoice) {
    return this.putItem(STORES.invoices, {
      ...invoice,
      savedOfflineAt: new Date(),
      synced: false,
    });
  }

  async getLocalProducts(tenantId) {
    return this.getItemsByIndex(STORES.products, 'tenantId', tenantId);
  }

  async getLocalInventory(tenantId) {
    return this.getItemsByIndex(STORES.inventory, 'tenantId', tenantId);
  }

  async getLocalCustomers(tenantId) {
    return this.getItemsByIndex(STORES.customers, 'tenantId', tenantId);
  }

  async getLocalInvoices(tenantId) {
    const allInvoices = await this.getAllItems(STORES.invoices);
    return allInvoices.filter((inv) => inv.tenantId === tenantId);
  }

  async getUnsyncedInvoices() {
    const allInvoices = await this.getAllItems(STORES.invoices);
    return allInvoices.filter((inv) => !inv.synced);
  }

  async markInvoiceAsSynced(invoiceId) {
    const invoice = await this.getItem(STORES.invoices, invoiceId);
    if (invoice) {
      invoice.synced = true;
      invoice.syncedAt = new Date();
      await this.putItem(STORES.invoices, invoice);
    }
  }
}

export default new IndexedDBService();
