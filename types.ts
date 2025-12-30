
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface VoiceAnalysis {
  gender: string;
  pitch: string;
  characteristics: string[];
  visualDescription: string;
}

export interface Voice {
  name: string;
  pitch: string;
  characteristics: string[];
  audioSampleUrl: string;
  fileUri: string;
  analysis: VoiceAnalysis;
  imageUrl: string; 
}

export interface Service {
  id: string;
  title: string;
  description: string;
  price: string;
  category: 'Software' | 'Hardware' | 'Consulting';
}

export interface Lead {
  name: string;
  contact: string;
  issue: string;
}

export interface Appointment {
  date: string;
  time: string;
  service: string;
}

export interface AiRecommendation {
  voiceNames: string[];
  systemInstruction: string;
  sampleText: string;
}

/**
 * Interface representing the state of filters for voice searching.
 */
export interface FilterState {
  search: string;
  gender: string;
  pitch: string;
}
