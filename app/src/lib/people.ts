import type { OwnerId, Person } from './types';

export const people: Person[] = [
  { id: 'carla', name: 'Carla Guilhem', short: 'Carla', initial: 'C', bg: 'linear-gradient(135deg,#FFB59A,#F7C8D6)', keys: ['carla'] },
  { id: 'fernanda', name: 'Fernanda Britto', short: 'Fernanda', initial: 'F', bg: 'linear-gradient(135deg,#C9B8E8,#A8C5F0)', keys: ['fernanda'] },
  { id: 'luiz', name: 'Luiz Eduardo Greco', short: 'Luiz', initial: 'L', bg: 'linear-gradient(135deg,#B8E0CA,#FFE3A8)', keys: ['luiz', 'eduardo'] },
  { id: 'alessandra', name: 'Alessandra Lopes', short: 'Alessandra', initial: 'A', bg: 'linear-gradient(135deg,#E89BB5,#FFB59A)', keys: ['alessandra'] },
  { id: 'nicola', name: 'Nicola', short: 'Nicola', initial: 'N', bg: 'linear-gradient(135deg,#A8C5F0,#B8E0CA)', keys: ['nicola'] },
  { id: 'eugenia', name: 'Eugenia Galdo', short: 'Eugenia', initial: 'E', bg: 'linear-gradient(135deg,#FFE3A8,#F7C8D6)', keys: ['eugenia', 'galdo'] },
  { id: 'francesca', name: 'Francesca', short: 'Francesca', initial: 'Fr', bg: 'linear-gradient(135deg,#F7C8D6,#A8C5F0)', keys: ['francesca'] },
  { id: 'yevgeniy', name: 'Yevgeniy Davidenko', short: 'Yevgeniy', initial: 'Y', bg: 'linear-gradient(135deg,#B8E0CA,#C9B8E8)', keys: ['yevgeniy', 'davidenko'] },
  { id: 'none', name: 'Unassigned', short: 'Unassigned', initial: '?', bg: 'linear-gradient(135deg,#E8E4DA,#DCD7CB)', keys: [] },
];

export const ownerIds: OwnerId[] = people.map(p => p.id);

export function person(id: OwnerId | string | null | undefined): Person {
  return people.find(p => p.id === id) || people[people.length - 1];
}

export const catColors: Record<string, string> = {
  'Finance': '#B8E0CA',
  'Project / Work': '#C9B8E8',
  'Action required': '#FFB59A',
  'Scheduling': '#FFE3A8',
  'Legal': '#F7C8D6',
  'System / Notification': '#DCD7CB',
  'Client / Sales': '#A8C5F0',
  'Personal': '#E89BB5',
};

export function catColor(category: string): string {
  return catColors[category] || 'var(--linen)';
}
