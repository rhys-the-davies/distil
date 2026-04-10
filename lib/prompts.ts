import fs from 'fs'
import path from 'path'

export function getReviewPrompt(): string {
  return fs.readFileSync(path.join(process.cwd(), 'prompts/review.md'), 'utf-8')
}
