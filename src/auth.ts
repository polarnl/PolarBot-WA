import fs from 'fs';
import path from 'path';
import { initAuthCreds } from '@whiskeysockets/baileys/lib/Utils/auth-utils';
import { BufferJSON } from '@whiskeysockets/baileys/lib/Utils/generics';

export type AuthState = any;

function ensureDirExists(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function readJSONSync(filePath: string) {
  try {
    const raw = fs.readFileSync(filePath, { encoding: 'utf8' });
    return JSON.parse(raw, BufferJSON.reviver);
  }
  catch (err) {
    return null;
  }
}

function writeJSONAtomicSync(filePath: string, data: any) {
  ensureDirExists(path.dirname(filePath));
  const tmp = `${filePath}.tmp-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, BufferJSON.replacer));
  fs.renameSync(tmp, filePath);
}

/**
 * Custom file-backed auth state.
 * - initializes creds using Baileys' initAuthCreds when missing
 * - persists creds to the provided filePath
 * - stores signal keys under <dir>/keys/<type>-<id>.json
 */
export function useCustomAuthState(filePath: string) {
  const folder = path.dirname(filePath) || '.';
  ensureDirExists(folder);

  // creds.json
  const credsFile = filePath;
  let creds = readJSONSync(credsFile) || initAuthCreds();

  const keysFolder = path.join(folder, 'keys');
  ensureDirExists(keysFolder);

  const keys = {
    get: async (type: string, ids: string[]) => {
      const data: Record<string, any> = {};
      for (const id of ids) {
        const file = path.join(keysFolder, `${type}-${id}.json`);
        const v = readJSONSync(file);
        data[id] = v ?? undefined;
      }
      return data;
    },
    set: async (data: Record<string, Record<string, any>>) => {
      for (const category in data) {
        for (const id in data[category]) {
          const value = data[category][id];
          const file = path.join(keysFolder, `${category}-${id}.json`);
          if (value == null) {
            try { fs.unlinkSync(file); } catch { }
          }
          else {
            writeJSONAtomicSync(file, value);
          }
        }
      }
    }
  };

  const state = { creds, keys };

  const saveCreds = async () => {
    try {
      writeJSONAtomicSync(credsFile, creds);
    }
    catch (err) {
      // don't crash the process for IO errors here
    }
  };

  return { state, saveCreds };
}
