import type { Metadata } from 'next';
import { MedicinesPage } from '../medicines/MedicinesPage';

export const metadata: Metadata = {
  title: 'Schedule my medicines – LAI App',
  description: 'Organise your medicines around your usual day in the LAI App.',
};

export default function Home() {
  return <MedicinesPage />;
}
