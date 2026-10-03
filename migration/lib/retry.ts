/**
 * Run a database write a second time if the first attempt hits a MongoDB transaction race.
 *
 * Payload validates a document's upload/relationship fields in parallel inside one MongoDB
 * transaction; now and then the driver loses that race (TransientTransactionError) and Payload
 * reports the field as invalid (ValidationError). The failed transaction was rolled back, so
 * trying again is safe, and a genuine validation error fails the same way twice and is still
 * reported. Any other error (duplicate key, network, …) is thrown at once.
 */
export async function retryOnce<T>(
  write: () => Promise<T>,
  { delayMs = 500, onRecovered }: { delayMs?: number; onRecovered?: () => void } = {},
): Promise<T> {
  try {
    return await write()
  } catch (err) {
    if (!isTransient(err)) throw err
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    const result = await write()
    onRecovered?.()
    return result
  }
}

function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  if (err.name === 'ValidationError') return true
  const labelled = err as Error & { hasErrorLabel?: (label: string) => boolean }
  return labelled.hasErrorLabel?.('TransientTransactionError') === true
}
