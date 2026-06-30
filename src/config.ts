import { ProfileId } from './types';

export const PROFILE_CONFIG: Record<ProfileId, { label: string; lat: number; lng: number; departHour: number; departMinute: number; returnHour: number; returnMinute: number }> = {
  farm: {
    label: 'Moorabbin',
    lat: -37.947291,
    lng: 145.064560,
    departHour: 8, departMinute: 0,
    returnHour: 17, returnMinute: 30,
  },
  firsthome: {
    label: 'Marnebek School, Cranbourne',
    lat: -38.1156,
    lng: 145.2831,
    departHour: 8, departMinute: 0,
    returnHour: 16, returnMinute: 0,
  },
};

export const SCORE_LABELS: Record<ProfileId, {
  commute: string;
  commuteWeight: string;
  land: string;
  landWeight: string;
  budget: string;
  budgetWeight: string;
  primary: string;
  primaryWeight: string;
  primaryScore: (p: { horseScore: number; houseSizeScore: number }) => number;
  showSecondary: boolean;
  secondary: string;
}> = {
  farm: {
    commute: 'Commute',
    commuteWeight: '35%',
    land: 'Land',
    landWeight: '25%',
    budget: 'Budget',
    budgetWeight: '20%',
    primary: 'Horse',
    primaryWeight: '10%',
    primaryScore: p => p.horseScore,
    showSecondary: true,
    secondary: 'Build',
  },
  firsthome: {
    commute: 'Commute',
    commuteWeight: '20%',
    land: 'Land Size',
    landWeight: '20%',
    budget: 'Budget',
    budgetWeight: '35%',
    primary: 'House',
    primaryWeight: '25%',
    primaryScore: p => p.houseSizeScore,
    showSecondary: false,
    secondary: '',
  },
};
