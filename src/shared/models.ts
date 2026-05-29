export interface ModelDefinition {
  id: string
  label: string
  inputPricePerMToken: number
  outputPricePerMToken: number
}

export const MODEL_DEFINITIONS: ModelDefinition[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    inputPricePerMToken: 0.075,
    outputPricePerMToken: 0.3,
  },
  {
    id: 'gemini-2.5-flash-lite-preview-06-17',
    label: 'Gemini 2.5 Flash-Lite',
    inputPricePerMToken: 0.025,
    outputPricePerMToken: 0.1,
  },
]
