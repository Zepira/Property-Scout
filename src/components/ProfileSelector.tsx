import { Profile, ProfileId } from '../types';

interface Props {
  profiles: Profile[];
  activeProfile: ProfileId;
  onChange: (id: ProfileId) => void;
}

export function ProfileSelector({ profiles, activeProfile, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border-dark">
      <span className="text-[10px] font-semibold text-text-dim uppercase tracking-widest whitespace-nowrap">
        Profile
      </span>
      <select
        value={activeProfile}
        onChange={e => onChange(e.target.value as ProfileId)}
        className="flex-1 bg-bg-dark text-text-main border border-border-dark rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-dark cursor-pointer"
      >
        {profiles.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
