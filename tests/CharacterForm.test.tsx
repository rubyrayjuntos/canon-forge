import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CharacterForm from '../components/CharacterForm';
import { INITIAL_CHARACTER_PROFILE } from '../constants';
import { generateId, generateSeed } from '../utils/randomizers';

const baseProfile = { ...INITIAL_CHARACTER_PROFILE, id: generateId(), seed: generateSeed() };

describe('CharacterForm', () => {
  it('renders all input fields', () => {
    render(<CharacterForm profile={baseProfile} setProfile={vi.fn()} onRandomize={vi.fn()} />);
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. 28')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Wiry athletic')).toBeInTheDocument();
  });

  it('calls setProfile with updated name when name input changes', () => {
    const setProfile = vi.fn();
    render(<CharacterForm profile={baseProfile} setProfile={setProfile} onRandomize={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText('Full Name'), {
      target: { name: 'name', value: 'Silas Thorne' },
    });

    expect(setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Silas Thorne' })
    );
  });

  it('calls onRandomize when the randomize button is clicked', () => {
    const onRandomize = vi.fn();
    render(<CharacterForm profile={baseProfile} setProfile={vi.fn()} onRandomize={onRandomize} />);

    fireEvent.click(screen.getByRole('button', { name: /randomize remaining/i }));
    expect(onRandomize).toHaveBeenCalledTimes(1);
  });
});
