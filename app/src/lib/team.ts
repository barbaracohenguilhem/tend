import type { OwnerId, Role } from './types';

export interface Member { email: string; name: string; short: string; role: Role; owner: OwnerId | null; active: boolean }

/** The studio roster. Sign-in role and task scope come from here; unknown @carlaguilhem.com addresses fall back to team by first name. */
export const DIRECTORY: Member[] = [
  { email: 'design@carlaguilhem.com', name: 'Carla Guilhem', short: 'Carla', role: 'carla', owner: 'carla', active: true },
  { email: 'bc@carlaguilhem.com', name: 'Barbara Cohen', short: 'Barbara', role: 'barbara', owner: null, active: true },
  { email: 'al@carlaguilhem.com', name: 'Alessandra Lopes', short: 'Alessandra', role: 'team', owner: 'alessandra', active: true },
  { email: 'egreco@carlaguilhem.com', name: 'Eduardo Greco', short: 'Eduardo', role: 'team', owner: 'luiz', active: true },
  { email: 'meg@carlaguilhem.com', name: 'Eugenia Galdo', short: 'Eugenia', role: 'team', owner: 'eugenia', active: true },
  { email: 'fb@carlaguilhem.com', name: 'Fernanda Britto', short: 'Fernanda', role: 'team', owner: 'fernanda', active: true },
  { email: 'fc@carlaguilhem.com', name: 'Francesca', short: 'Francesca', role: 'team', owner: 'francesca', active: true },
  { email: 'yd@carlaguilhem.com', name: 'Yevgeniy Davidenko', short: 'Yevgeniy', role: 'team', owner: 'yevgeniy', active: true },
  { email: 'bl@carlaguilhem.com', name: 'Barbara Lustbader', short: 'Barbara L.', role: 'team', owner: null, active: false },
  { email: 'imb@carlaguilhem.com', name: 'Ivian Berger', short: 'Ivian', role: 'team', owner: null, active: false },
];

export function member(email: string): Member | undefined {
  return DIRECTORY.find(m => m.email === email.trim().toLowerCase());
}
