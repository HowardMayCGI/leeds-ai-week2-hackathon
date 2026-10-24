import type { Metadata } from 'next';
import { MedicinesPage } from '../medicines/MedicinesPage';

export const metadata: Metadata = {
  title: 'Schedule my medicines – NHS App concept',
  description: 'A concept for an NHS App feature that organises your medicines around your usual day.',
};

export default function Home() {
  return <MedicinesPage />;
}
