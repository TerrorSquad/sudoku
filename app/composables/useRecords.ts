import { addLoss, addWin, readRecords, type Records, type WinFacts } from "../utils/records";
import { readJSON, writeJSON } from "../utils/safeJson";

export const RECORDS_KEY = "sudoku_v1_records";

/** Personal records (rules in utils/records.ts). */
export function useRecords() {
  const get = (): Records => readRecords(readJSON<unknown>(RECORDS_KEY, null));
  const recordWin = (win: WinFacts) => writeJSON(RECORDS_KEY, addWin(get(), win));
  function recordLoss() {
    const rec = get();
    if (rec.cleanRun) writeJSON(RECORDS_KEY, addLoss(rec));
  }
  return { get, recordWin, recordLoss };
}
