export type BloodPressureTone = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis' | 'low'

export interface BloodPressureReading {
  systolic: number
  diastolic: number | null
  category: string
  tone: BloodPressureTone
  reference: string
  guidance: string
  source: string
}

export type BloodPressureResult =
  | { status: 'empty' }
  | { status: 'invalid'; message: string }
  | { status: 'ok'; reading: BloodPressureReading }

const SOURCE = 'ACC/AHA 2017'

function reading(
  systolic: number,
  diastolic: number | null,
  tone: BloodPressureTone,
  category: string,
  reference: string,
  guidance: string
): BloodPressureReading {
  return { systolic, diastolic, tone, category, reference, guidance, source: SOURCE }
}

/**
 * Classifies a free-text blood pressure entry using the ACC/AHA 2017 categories.
 * Accepts forms such as "120/80", "BP 140 / 90", "120 over 80", or "130-85".
 */
export function classifyBloodPressure(value: unknown): BloodPressureResult {
  const text = String(value ?? '').trim()
  if (!text) return { status: 'empty' }

  const numbers = (text.match(/\d{1,3}(?:[.,]\d+)?/g) ?? [])
    .map((part) => Number(part.replace(',', '.')))
    .filter((part) => Number.isFinite(part))

  if (numbers.length === 0) {
    return { status: 'invalid', message: 'Enter systolic/diastolic, e.g. 120/80.' }
  }
  if (numbers.some((part) => part < 20 || part > 320)) {
    return { status: 'invalid', message: 'That value looks out of range. Enter e.g. 120/80.' }
  }

  const systolic = Math.round(numbers[0])
  const diastolic = numbers.length > 1 ? Math.round(numbers[1]) : null

  if (diastolic !== null && diastolic >= systolic) {
    return {
      status: 'invalid',
      message: 'Systolic should be the first and higher number, e.g. 120/80.'
    }
  }
  if (systolic < 70) {
    return { status: 'invalid', message: 'Systolic below 70 mmHg looks like a typo. Please recheck.' }
  }
  if (diastolic !== null && diastolic < 30) {
    return { status: 'invalid', message: 'Diastolic below 30 mmHg looks like a typo. Please recheck.' }
  }

  const suffix = diastolic === null ? ' Add diastolic for a complete reading.' : ''

  if (systolic >= 180 || (diastolic !== null && diastolic >= 120)) {
    return {
      status: 'ok',
      reading: reading(
        systolic,
        diastolic,
        'crisis',
        'Hypertensive crisis',
        '≥180 and/or ≥120 mmHg',
        `Urgent medical review is needed before diet or exercise changes.${suffix}`
      )
    }
  }
  if (systolic >= 140 || (diastolic !== null && diastolic >= 90)) {
    return {
      status: 'ok',
      reading: reading(
        systolic,
        diastolic,
        'stage2',
        'Stage 2 hypertension',
        '≥140 and/or ≥90 mmHg',
        `High. Confirm with the treating doctor; support with low-sodium and weight goals.${suffix}`
      )
    }
  }
  if (systolic >= 130 || (diastolic !== null && diastolic >= 80)) {
    return {
      status: 'ok',
      reading: reading(
        systolic,
        diastolic,
        'stage1',
        'Stage 1 hypertension',
        '130–139 and/or 80–89 mmHg',
        `High. Reinforce low-sodium, activity, and weight goals; recheck and confirm the diagnosis.${suffix}`
      )
    }
  }
  if (systolic < 90 || (diastolic !== null && diastolic < 60)) {
    return {
      status: 'ok',
      reading: reading(
        systolic,
        diastolic,
        'low',
        'Low blood pressure',
        '<90 and/or <60 mmHg',
        `Low. Check for dizziness or fainting and review medication timing.${suffix}`
      )
    }
  }
  if (systolic >= 120) {
    return {
      status: 'ok',
      reading: reading(
        systolic,
        diastolic,
        'elevated',
        'Elevated',
        '120–129 and <80 mmHg',
        `Borderline. Monitor and reinforce sodium, weight, and activity goals.${suffix}`
      )
    }
  }
  return {
    status: 'ok',
    reading: reading(
      systolic,
      diastolic,
      'normal',
      'Normal',
      '<120 and <80 mmHg',
      `Within the normal range.${suffix}`
    )
  }
}
