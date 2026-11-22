import { describe, expect, it } from 'vitest';
import { aiComplete } from './index';
import { buttonShapeFor, explicitButtonShape } from './button-shape';

describe('button shape from a brief', () => {
  it('reads explicit words', () => {
    expect(explicitButtonShape('clean shop with flat buttons')).toBe('square');
    expect(explicitButtonShape('square buttons please')).toBe('square');
    expect(explicitButtonShape('pill buttons, gold accents')).toBe('pill');
    expect(explicitButtonShape('warm boutique with rounded buttons')).toBe('rounded');
    expect(explicitButtonShape('warm boutique')).toBeNull();
  });

  it('explicit words beat the model and the layout', () => {
    expect(buttonShapeFor('flat buttons', 'playful', 'pill')).toBe('square');
    expect(buttonShapeFor('rounded buttons', 'bold', 'square')).toBe('rounded');
  });

  it('falls back to the model, then vibe, then layout', () => {
    expect(buttonShapeFor('nice shop', 'modern', 'pill')).toBe('pill');
    expect(buttonShapeFor('cute bakery', 'modern')).toBe('pill');
    expect(buttonShapeFor('nice shop', 'bold')).toBe('square');
    expect(buttonShapeFor('nice shop', 'modern')).toBe('rounded');
  });

  it('the keyless style draft always carries a button shape', async () => {
    const flat = await aiComplete({ feature: 'style_store', input: '(fashion): elegant shop with flat buttons' });
    expect((flat.draft as { button_shape?: string }).button_shape).toBe('square');
    const round = await aiComplete({ feature: 'style_store', input: '(food): rounded buttons, warm colours' });
    expect((round.draft as { button_shape?: string }).button_shape).toBe('rounded');
  });
});
