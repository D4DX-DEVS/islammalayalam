import { rm } from 'node:fs/promises'
import mongoose from 'mongoose'
import { TEST_DATABASE_URL } from './env'

/** Fresh, isolated state for every integration run: drop ONLY the `_test` database and test uploads. */
export default async function setup(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL.replace('mongodb://', 'http://'))
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/islammalayalam_test')
    throw new Error('Refusing to reset a non-test database')
  const conn = await mongoose
    .createConnection(TEST_DATABASE_URL, { serverSelectionTimeoutMS: 5000 })
    .asPromise()
  await conn.dropDatabase()
  await conn.close()
  await rm('.test-media', { recursive: true, force: true })
}
