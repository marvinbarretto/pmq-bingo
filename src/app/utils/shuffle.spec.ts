import { describe, it, expect } from 'vitest';
import { shuffle } from './shuffle';

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr)).toHaveLength(arr.length);
  });

  it('contains the same elements (no duplicates, no missing)', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result.slice().sort()).toEqual(arr.slice().sort());
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });

  it('works with generic types (strings)', () => {
    const arr = ['a', 'b', 'c', 'd'];
    const result = shuffle(arr);
    expect(result).toHaveLength(arr.length);
    expect(result.slice().sort()).toEqual(arr.slice().sort());
  });

  it('works with generic types (objects)', () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = shuffle(arr);
    expect(result).toHaveLength(arr.length);
    expect(result).toEqual(expect.arrayContaining(arr));
  });

  it('returns a new array (not the same reference)', () => {
    const arr = [1, 2, 3];
    const result = shuffle(arr);
    expect(result).not.toBe(arr);
  });

  it('handles an empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('handles a single-element array', () => {
    expect(shuffle([42])).toEqual([42]);
  });
});
