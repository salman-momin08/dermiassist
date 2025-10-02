
import { EventEmitter } from 'events';

// A simple event emitter to act as a global bus for permission errors
// This allows client-side data fetching functions to communicate with a React component.
export const errorEmitter = new EventEmitter();
