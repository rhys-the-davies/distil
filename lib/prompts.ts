import fs from 'fs'
import path from 'path'

export function getReviewPrompt(): string {
  return fs.readFileSync(path.join(process.cwd(), 'prompts/review.md'), 'utf-8')
}

export function getObservePrompt(): string {
  return fs.readFileSync(path.join(process.cwd(), 'prompts/observe.md'), 'utf-8')
}

export function getStructurePrompt(): string {
  return fs.readFileSync(path.join(process.cwd(), 'prompts/structure.md'), 'utf-8')
}
