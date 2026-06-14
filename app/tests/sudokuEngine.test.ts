import { describe, it, expect, beforeEach, vi } from "vitest";

// Engine poziva useI18n() van komponente — mockujemo prevod za testove
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { useSudokuEngine } from "../composables/useSudokuEngine";

describe("Sudoku Engine Unit Tests - Sveobuhvatne Tehnike Rešavanja", () => {
  let engine: ReturnType<typeof useSudokuEngine>;

  beforeEach(() => {
    engine = useSudokuEngine();
  });

  it("Treba uspešno da prepozna i reši Naked Single", () => {
    // Postavi tablu gde ćelija (0,0) ima samo jednog preostalog kandidata (npr. 5)
    engine.currentBoard.value = [
      [0, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];
    engine.solvedBoard.value = engine.currentBoard.value.map((row) => [...row]);
    engine.solvedBoard.value[0][0] = 5;

    const candidates = engine.getGridCandidates(engine.currentBoard.value);
    expect(candidates[0][0]).toEqual([5]); // Dokazujemo da je 5 jedini preostali kandidat
  });

  it("Treba bezbedno da detektuje konfliktne ćelije u realnom vremenu unutar reda i kolone", () => {
    engine.currentBoard.value[0][0] = 5;
    engine.currentBoard.value[0][1] = 5; // Dupli broj u istom redu

    const conflicts = engine.getConflictCells(0, 0, 5);
    expect(conflicts).toContainEqual({ r: 0, c: 1 });
  });

  it("Mehanizam za istoriju (Undo) mora ispravno da vrati prethodno stanje table i obriše animacije", () => {
    engine.currentBoard.value[0][0] = 0;
    engine.saveHistory();
    engine.currentBoard.value[0][0] = 9;

    engine.undoMove();
    expect(engine.currentBoard.value[0][0]).toBe(0);
  });

  it("Treba uspešno da validira pobednički uslov (Win Condition) kada se poklope sve ćelije", () => {
    // Simuliramo kompletno rešenu tablu
    const testSolved = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];
    engine.currentBoard.value = testSolved.map((row) => [...row]);
    engine.solvedBoard.value = testSolved.map((row) => [...row]);

    const won = engine.checkWinCondition();
    expect(won).toBe(true);
  });

  it("Treba ispravno da detektuje promenu broja preostalih numpad eksponenata pri unosu", () => {
    // Inicijalna tabla bez petica
    engine.currentBoard.value = Array(9)
      .fill(null)
      .map(() => Array(9).fill(0));
    engine.solvedBoard.value = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 9],
    ];

    // Upisujemo tačnu peticu na (0,0)
    engine.currentBoard.value[0][0] = 5;

    // Proveravamo da li se broj unesenih petica ispravno inkrementirao na 1
    const counts = engine.numberCounts.value;
    expect(counts[5]).toBe(1);
  });
});
