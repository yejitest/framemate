export type TaskMode = 'component' | 'screen'

export type TaskStatus = 'pending' | 'running' | 'success' | 'error'

export interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

export interface Task {
  id: string
  mode: TaskMode
  prompt: string
  status: TaskStatus
  figmaLink?: string
  createdAt: Date
  summary?: string
}

export interface FigmaSettings {
  personalAccessToken: string
  dsFileUrl: string
}
