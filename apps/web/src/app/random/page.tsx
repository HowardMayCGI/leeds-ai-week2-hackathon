import type { Metadata } from 'next';
import { RandomGenerator } from './random-generator';

export const metadata: Metadata = {
  title: 'Random number generator | NHS App concept',
  description: 'Generate a random number from 1 to 100.',
};

export default function RandomPage() {
  return <RandomGenerator />;
}
