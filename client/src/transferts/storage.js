import * as CONST_TRANSFERT from './constantes'

export async function supprimerCacheFuuid(fuuid, opts) {
    opts = opts || {}
    const cacheChiffre = await caches.open(CONST_TRANSFERT.CACHE_DOWNLOAD_CHIFFRE)
    cacheChiffre.delete(`/${fuuid}`, {ignoreSearch: true})
    
    //const parts = await getPartsDownload(fuuid)
    // for await(const part of parts) {
    //     await cacheChiffre.delete(part.request)
    // }
  
    if(!opts.keepDechiffre) {
        const cacheDechiffre = await caches.open(CONST_TRANSFERT.CACHE_DOWNLOAD_DECHIFFRE)
        cacheDechiffre.delete(`/${fuuid}`, {ignoreSearch: true})

        // const partsDechiffre = await getPartsDownload(fuuid, {cache: CONST_TRANSFERT.CACHE_DOWNLOAD_DECHIFFRE})
        // await cacheDechiffre.delete('/'+fuuid)
        // for await(const part of partsDechiffre) {
        //     await cacheDechiffre.delete(part.request)
        // }
    }
}

// function trierParts(parts) {
//     console.debug("trierParts %O", parts)
//     for(const part of parts) {
//         console.debug("Part : %O, statusText: %O", part, part.statusText)
//     }
//     // Generer dict par position
//     const fichiers = parts.reduce((acc, item)=>{
//         const position = Number.parseInt(item.statusText)
//         // const position = new URL(item.url).searchParams.get('position')
//         acc[position] = item
//         return acc
//     }, {})

//     // Trier positions
//     const listePositions = Object.keys(fichiers).map(item=>Number.parseInt(item))
//     listePositions.sort((a, b) => a - b)

//     // Mapper cache en ordre
//     const listeTriee = listePositions.map(item=>fichiers[''+item])

//     return listeTriee
// }

export async function getPartsDownload(fuuid, opts) {
    opts = opts || {}
    const cacheName = opts.cache || CONST_TRANSFERT.CACHE_DOWNLOAD_CHIFFRE
    const cache = await caches.open(cacheName)
    const parts = await cache.matchAll(`/${fuuid}`, {ignoreSearch: true})

    const partsObj = parts.map(item=>{
        return {position: Number.parseInt(item.statusText), response: item}
    })
    partsObj.sort((a, b) => a.position - b.position)
    return partsObj

    // return trierParts(parts)

    // const parts = []
    // {
    //     const keys = await cache.keys()
    //     for await(const key of keys) {
    //         // console.debug("getPartsDownload Key : ", key.url)
    //         const pathName = new URL(key.url).pathname
    //         if(pathName.startsWith('/'+fuuid)) {
    //             const position = Number.parseInt(pathName.split('/').pop())
    //             if(position !== undefined && !isNaN(position)) {
    //                 const response = await cache.match(key)
    //                 parts.push({position, request: key, response})
    //             }
    //         }
    //     }
    // }

    // parts.sort(trierPositionsCache)
    // return parts
}

/** Stream toutes les parts chiffrees d'un fichier downloade vers un writable. */
export async function streamPartsChiffrees(fuuid, writable, opts) {
    opts = opts || {}
    const tailleChiffre = opts.tailleChiffre
    const progressCb = opts.progressCb

    // Recuperer parts tries en ordre de position
    const parts = await getPartsDownload(fuuid, opts)
  
    // Pipe tous les blobs (response)
    let positionDechiffrage = 0
    for await(const part of parts) {
        // console.debug("streamPartsChiffrees Stream part a position ", positionDechiffrage)
        const blob = await part.response.blob()
        const readerPart = blob.stream()
        // S'assurer de ne pas fermer le writable apres le pipeTo
        await readerPart.pipeTo(writable, {preventClose: true})

        // Mise a jour de l'etat (progress)
        if(progressCb) {
            const tailleBlob = blob.size
            positionDechiffrage += tailleBlob
            await progressCb(positionDechiffrage, {'champ': 'tailleDechiffree'})
        }
    }
    writable.close()

    // Validation de la taille du fichier (optionelle)
    if(tailleChiffre && tailleChiffre !== positionDechiffrage) throw new Error('mismatch taille chiffree')
}

export async function createWritableStream(fuuid, opts) {
    const limitSplitBytes = opts.splitLimit || CONST_TRANSFERT.LIMITE_DOWNLOAD_CACHE_SPLIT_MOBILE
    let arrayBuffers = [], tailleChunks = 0
    let position = 0

    const cache = await caches.open(CONST_TRANSFERT.CACHE_DOWNLOAD_DECHIFFRE)
    // const queuingStrategy = new CountQueuingStrategy({ highWaterMark: 1 })
    const queuingStrategy = new ByteLengthQueuingStrategy({ highWaterMark: 256 * 1024, size: 64*1024 })
    const stream = new WritableStream(
        {
          start(controller) {},
          async write(chunk, controller) {
            // console.debug("streamToCacheParts for await chunk len %s", chunk?chunk.length:'null')
            if(chunk && chunk.length > 0) {
                arrayBuffers.push(chunk)
                tailleChunks += chunk.length
                position += chunk.length
            }
      
            if(tailleChunks > limitSplitBytes) {
                // Split chunks en parts
                {
                    const blob = new Blob(arrayBuffers)
                    const positionBlob = position - blob.size
                    arrayBuffers = []
                    tailleChunks = 0
                    const response = new Response(blob, {status: 200, statusText: ''+positionBlob})
                    const fuuidPath = '/'+fuuid+'?position='+positionBlob
                    await cache.put(fuuidPath, response)
                }
            }
          },
          async close(controller) {
            // console.debug("createWritableStream Close output")
            if(arrayBuffers.length > 0) {
                const blob = new Blob(arrayBuffers)
                const positionBlob = position - blob.size
                arrayBuffers = []
                const response = new Response(blob, {status: 200, statusText: ''+positionBlob})
                const fuuidPath = '/'+fuuid+'?position='+positionBlob
                await cache.put(fuuidPath, response)
            }
          },
          abort(reason) {},
        },
        queuingStrategy,
      )

    return stream
}

/**
 * Lit un stream vers le cache de fichiers dechiffres. Split le contenu.
 * @param {*} fuuid 
 * @param {*} stream 
 * @param {*} opts limitSplitBytes: int
 */
export async function streamToCacheParts(fuuid, stream, opts) {
    opts = opts || {}
    const writableStream = await createWritableStream(fuuid, opts)
    await stream.pipeTo(writableStream)
    return true
}

// function trierPositionsCache(a, b) {
//     if(a === b) return 0
//     if(!a) return 1
//     if(!b) return -1
  
//     // Trier par date de creation
//     const positionA = a.position,
//           positionB = b.position
//     // if(dateCreationA === dateCreationB) return 0
//     if(positionA !== positionB) return positionA - positionB
//     return 0
// }
  