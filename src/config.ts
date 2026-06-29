import { ProfileId } from './types';

export const PROFILE_CONFIG: Record<ProfileId, { label: string; lat: number; lng: number }> = {
  farm: {
    label: 'Moorabbin',
    lat: -37.947291,
    lng: 145.064560,
  },
  firsthome: {
    label: 'Marnebek School, Cranbourne',
    lat: -38.1156,
    lng: 145.2831,
  },
};

export const SCORE_LABELS: Record<ProfileId, {
  commute: string;
  land: string;
  budget: string;
  primary: string;
  primaryScore: (p: { horseScore: number; houseSizeScore: number }) => number;
  showSecondary: boolean;
  secondary: string;
}> = {
  farm: {
    commute: 'Commute',
    land: 'Land',
    budget: 'Budget',
    primary: 'Horse',
    primaryScore: p => p.horseScore,
    showSecondary: true,
    secondary: 'Build',
  },
  firsthome: {
    commute: 'Commute',
    land: 'Land Size',
    budget: 'Budget',
    primary: 'House',
    primaryScore: p => p.houseSizeScore,
    showSecondary: false,
    secondary: '',
  },
};
