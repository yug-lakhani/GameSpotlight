import React from 'react';
import Input from './ui/Input';
import PrettySelect from './PrettySelect';
import Button from './ui/Button';

export default function FiltersPanel({ filters = {}, onChange = () => {}, onApply = () => {}, onReset = () => {} }) {
  return (
    <div className="space-y-4">
      <div>
        <Input label="Search" id="filter-search" value={filters.q || ''} onChange={(v) => onChange({ ...filters, q: v })} placeholder="Search titles" />
      </div>

      <div>
        <label className="label-text">Genre</label>
        <PrettySelect id="filter-genre" options={['All', 'Action', 'RPG', 'Strategy', 'Indie']} value={filters.genre || 'All'} onChange={(v) => onChange({ ...filters, genre: v })} />
      </div>

      <div>
        <label className="label-text">Platform</label>
        <PrettySelect id="filter-platform" options={['All', 'PC', 'Mac', 'Linux', 'Console']} value={filters.platform || 'All'} onChange={(v) => onChange({ ...filters, platform: v })} />
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onReset}>Reset</Button>
        <Button onClick={() => onApply(filters)}>Apply</Button>
      </div>
    </div>
  );
}
