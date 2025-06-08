import { describe, it, expect } from 'vitest'
import { DurableFetchClient } from './sdk'
import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser'

async