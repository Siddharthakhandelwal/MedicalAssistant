/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly GROQ_API_KEY: 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
  readonly ELEVEN_LABS_API_KEY: string
  readonly OPENAI_API_KEY?: string
  readonly PERPLEXITY_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}