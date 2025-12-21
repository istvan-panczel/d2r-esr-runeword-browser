export const RequestState = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
} as const;

export type RequestState = (typeof RequestState)[keyof typeof RequestState];
