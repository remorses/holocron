import { LanguageModelV2, LanguageModelV2CallOptions, LanguageModelV2StreamPart } from '@ai-sdk/provider'

interface TestProviderSettings {
  model: LanguageModelV2
  errorAfterCharacters?: number
  errorMessage?: string
}

export function createTestProviderWithErrors(settings: TestProviderSettings): TestProviderWithErrors {
  return new TestProviderWithErrors(settings)
}

export class TestProviderWithErrors implements LanguageModelV2 {
  readonly specificationVersion = 'v2' as const
  private model: LanguageModelV2
  private errorAfterCharacters: number
  private errorMessage: string
  private hasStreamedOnce: boolean = false

  constructor(settings: TestProviderSettings) {
    this.model = settings.model
    this.errorAfterCharacters = settings.errorAfterCharacters ?? 100
    this.errorMessage = settings.errorMessage ?? 'Test error injected after characters'
  }

  get modelId(): string {
    return this.model.modelId
  }

  get provider(): string {
    return this.model.provider
  }

  get supportedUrls() {
    return this.model.supportedUrls
  }

  doGenerate(options: LanguageModelV2CallOptions) {
    return this.model.doGenerate(options)
  }

  async doStream(options: LanguageModelV2CallOptions) {
    console.trace(`calling doStream`)
    const result = await this.model.doStream(options)

    const wrappedStream = new ReadableStream<LanguageModelV2StreamPart>({
      start: async (controller) => {
        const reader = result.stream.getReader()
        let characterCount = 0

        try {
          while (true) {
            const { done, value } = await reader.read()

            if (done) {
              controller.close()
              break
            }

            // Count characters in text deltas
            if (value?.type === 'text-delta' && value.delta) {
              characterCount += value.delta.length
            }

            console.log(value)
            controller.enqueue(value)

            if (!this.hasStreamedOnce && characterCount >= this.errorAfterCharacters) {
              const errorChunk: LanguageModelV2StreamPart = {
                type: 'error',
                error: new Error(this.errorMessage),
              }
              this.hasStreamedOnce = true
              controller.enqueue(errorChunk)
              break
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          try {
            reader.releaseLock()
            controller.close()
          } catch (err) {
            // Optionally handle error or ignore
          }
        }
      },
    })

    return {
      ...result,
      stream: wrappedStream,
    }
  }
}
