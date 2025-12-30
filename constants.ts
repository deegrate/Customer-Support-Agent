
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { Service } from './types';

export const BUSINESS_INFO = {
  name: "Average Joe Computer Services",
  location: "123 Tech Lane, Silicon Valley, CA",
  phone: "(555) 123-4567",
  website: "https://averagejoecomputers.com/",
  hours: "Mon-Fri: 9am-6pm, Sat: 10am-4pm",
  tagline: "Expert repair for the rest of us."
};

export const SERVICES: Service[] = [
  {
    id: 'virus',
    title: 'Virus & Malware Removal',
    description: 'Deep cleaning of your system to remove all threats and restore performance.',
    price: '$99 - $149',
    category: 'Software'
  },
  {
    id: 'tuneup',
    title: 'PC Tune-Up',
    description: 'Optimization of startup, disk cleaning, and performance tweaks.',
    price: '$79',
    category: 'Software'
  },
  {
    id: 'screen',
    title: 'Laptop Screen Replacement',
    description: 'Fast replacement for cracked or dead laptop displays.',
    price: '$129 + parts',
    category: 'Hardware'
  },
  {
    id: 'data',
    title: 'Data Recovery',
    description: 'Attempted recovery of files from failing hard drives or deleted partitions.',
    price: 'Starting at $199',
    category: 'Software'
  },
  {
    id: 'os',
    title: 'OS Reinstallation',
    description: 'Clean install of Windows or macOS with all drivers.',
    price: '$120',
    category: 'Software'
  }
];
