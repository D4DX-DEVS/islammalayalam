import 'server-only'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

/** The only way the frontend talks to data: Payload's Local API in-process (no HTTP, no WordPress). */
export const getPayloadClient = (): Promise<Payload> => getPayload({ config })
