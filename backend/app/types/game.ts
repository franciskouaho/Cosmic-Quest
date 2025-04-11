export type GameTheme = 'standard' | 'fun' | 'dark' | 'personal' | 'crazy'

export interface GameSettings {
  theme: GameTheme
  rounds: number
  timePerQuestion: number
  timePerVote: number
  allowCustomQuestions: boolean
}
