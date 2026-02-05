import { openDB, DBSchema } from 'idb';

interface AppDB extends DBSchema {
    handles: {
        key: string;
        value: FileSystemDirectoryHandle;
    };
}

const DB_NAME = 'ai-pdf-manager-db';
const STORE_NAME = 'handles';

export async function initDB() {
    return openDB<AppDB>(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle) {
    const db = await initDB();
    await db.put(STORE_NAME, handle, 'root-dir');
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | undefined> {
    const db = await initDB();
    return db.get(STORE_NAME, 'root-dir');
}

export async function clearDirectoryHandle() {
    const db = await initDB();
    await db.delete(STORE_NAME, 'root-dir');
}
