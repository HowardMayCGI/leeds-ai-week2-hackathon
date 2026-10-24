import type { Metadata } from 'next';
import { RandomGenerator } from './random-generator';

export const metadata: Metadata = {
  title: 'Random number generator | LAI App',
  description: 'Generate a random number from 1 to 100 in the LAI App.',
};

export default function RandomPage() {
  return <RandomGenerator />;
}
