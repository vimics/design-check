import { describe, expect, it } from 'vitest';
import { matches, normalizeName } from '../src/app/check';

describe('names', () => {
  it.each([
    ['Ayşe Yılmaz', 'ayse yilmaz'],
    ['  AYŞE   YILMAZ ', 'ayse yilmaz'],
    ['İsmail Işık', 'ismail isik'],
    ['ismail isik', 'ismail isik'],
    ['Dr. Ayşe Yılmaz', 'ayse yilmaz'],
    ['Ayşe Yılmaz, DVM', 'ayse yilmaz'],
    ['Zoë Müller', 'zoe muller'],
    ['MAX', 'max'],
  ])('%s reads as %s', (typed, folded) => expect(normalizeName(typed)).toBe(folded));

  it('needs both names to match', () => {
    const expected = { dvm: 'Ayşe Yılmaz', patient: 'Max' };
    expect(matches({ dvm: 'ayse yilmaz', patient: 'MAX' }, expected)).toBe(true);
    expect(matches({ dvm: 'Ayşe Yılmaz', patient: 'Maxi' }, expected)).toBe(false);
    expect(matches({ dvm: 'Ayşe', patient: 'Max' }, expected)).toBe(false);
    expect(matches({ dvm: '', patient: '' }, expected)).toBe(false);
  });
});
