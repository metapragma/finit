import type { Event } from './types'

const classLabel: Record<string, string> = {
  ANON: 'Anonymous',
  FREE: 'Free',
  PAID: 'Paid',
}

const sentence = (value: string) =>
  value.endsWith('.') ? value : `${value}.`

type ReasonEntry = {
  summary: (event: Event) => string
}

const reasons: Record<string, ReasonEntry> = {
  QUEUE_ADMISSION: {
    summary: (event) =>
      sentence(`${classLabel[event.class] ?? 'User'} request enters the wait`),
  },
  PRIORITY_SCHEDULE: {
    summary: (event) =>
      sentence(`${classLabel[event.class] ?? 'User'} request starts sooner`),
  },
  SERVICE_COMPLETE: {
    summary: (event) =>
      sentence(`${classLabel[event.class] ?? 'User'} request completes`),
  },
  REJECT_OVERLOAD: {
    summary: () => sentence('Anonymous request is turned away'),
  },
}

export const explainEvent = (event: Event) => {
  const entry = reasons[event.reason_code]
  if (entry) {
    return entry.summary(event)
  }

  if (import.meta.env.DEV) {
    return sentence(`Event recorded (unknown reason: ${event.reason_code})`)
  }

  return sentence('Event recorded (reason unavailable)')
}

export const labelForClass = (value: string) =>
  classLabel[value] ?? 'User'

