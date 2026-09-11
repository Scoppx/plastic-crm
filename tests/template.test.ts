import { describe, it, expect } from 'vitest';
import { fillTemplate } from '../src/domain/template';

describe('fillTemplate', () => {
  it('replaces known placeholders', () => {
    expect(fillTemplate('Ciao {nome}, {mesi} mesi', { nome: 'Anna', mesi: 4 })).toBe('Ciao Anna, 4 mesi');
  });
  it('leaves unknown placeholders untouched', () => {
    expect(fillTemplate('Ciao {nome} {boh}', { nome: 'Anna' })).toBe('Ciao Anna {boh}');
  });
  it('replaces repeated placeholders', () => {
    expect(fillTemplate('{a}{a}', { a: 'x' })).toBe('xx');
  });
});
