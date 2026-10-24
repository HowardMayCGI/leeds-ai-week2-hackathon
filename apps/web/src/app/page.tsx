import type { Metadata } from 'next';
import { MedicinesApp } from '../medicines/MedicinesApp';

export const metadata: Metadata = {
  title: 'Schedule my medicines – LAI App',
  description: 'Leeds AI Week hackathon proof of concept: organise your medicines around your usual day in an NHS App-style journey.',
};

export default function Home() {
  return <MedicinesApp />;
}
