import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const FEEDBACK_FILE = resolve(process.cwd(), 'training-data/feedback.json');
let writeQueue = Promise.resolve();
async function readFeedback() {
    try {
        const raw = await readFile(FEEDBACK_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (err) {
        if (err.code === 'ENOENT')
            return [];
        throw err;
    }
}
async function writeFeedback(records) {
    await mkdir(dirname(FEEDBACK_FILE), { recursive: true });
    const temporaryFile = `${FEEDBACK_FILE}.tmp`;
    await writeFile(temporaryFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    await rename(temporaryFile, FEEDBACK_FILE);
}
export function saveFeedback(input) {
    let saved;
    const operation = writeQueue.then(async () => {
        const records = await readFeedback();
        const existingIndex = records.findIndex((record) => record.responseId === input.responseId);
        const now = new Date().toISOString();
        const existing = existingIndex >= 0 ? records[existingIndex] : null;
        saved = {
            ...input,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        if (existingIndex >= 0) {
            records[existingIndex] = saved;
        }
        else {
            records.push(saved);
        }
        await writeFeedback(records);
    });
    writeQueue = operation.catch(() => undefined);
    return operation.then(() => saved);
}
//# sourceMappingURL=store.js.map