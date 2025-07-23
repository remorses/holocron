import { fnvConsistentHash } from 'jump-gouache'

export function getShardNumber({
    filename,
    totalNumberOfShards,
}: {
    filename: string
    totalNumberOfShards: number
}) {
    return fnvConsistentHash(filename, totalNumberOfShards)
}
