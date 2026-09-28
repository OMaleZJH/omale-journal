import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function createLocalStore(filename) {
  mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id));
    CREATE UNIQUE INDEX IF NOT EXISTS unique_email ON records(json_extract(data,'$.email')) WHERE kind='users';
    CREATE TABLE IF NOT EXISTS rate_limits(id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);`);
  const decode = row => row ? JSON.parse(row.data) : null;
  return {
    async get(kind,id) { return decode(db.prepare('SELECT data FROM records WHERE kind=? AND id=?').get(kind,id)); },
    async list(kind,filters={}) {
      const entries=Object.entries(filters);
      for(const [key] of entries) if(!/^[a-z_]+$/i.test(key))throw new Error('Invalid field');
      const sql='SELECT data FROM records WHERE kind=?'+entries.map(([key])=>` AND json_extract(data,'$.${key}')=?`).join('')+' LIMIT 2000';
      return db.prepare(sql).all(kind,...entries.map(([,value])=>value)).map(decode);
    },
    async put(kind,id,data,insert=false) {
      db.prepare(insert?'INSERT INTO records(kind,id,data) VALUES(?,?,?)':'INSERT INTO records(kind,id,data) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data').run(kind,id,JSON.stringify(data));
      return data;
    },
    async remove(kind,id) {db.prepare('DELETE FROM records WHERE kind=? AND id=?').run(kind,id);},
    async rate(id,limit,seconds) {
      const now=Date.now();
      db.prepare('DELETE FROM rate_limits WHERE expires<?').run(now);
      const result=db.prepare('INSERT INTO rate_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').get(id,now+seconds*1000);
      return result.count<=limit;
    },
    close(){db.close();}
  };
}
