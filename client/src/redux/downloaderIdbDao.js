import { supprimerCacheFuuid } from '../transferts/filetransferDownloadClient'
import ouvrirDB from './idbMessages'

const STORE_DOWNLOADS = 'downloads'
const STORE_DOWNLOADS_FICHIERS = 'downloadsFichiers'

export function init() {
    return ouvrirDB()
}

export async function entretien() {
    const db = await ouvrirDB()

    // Retirer les valeurs expirees
    //await retirerDownloadsExpires(db)
}

export async function updateFichierDownload(doc) {
    const { fuuid, userId } = doc
    if(!fuuid) throw new Error('updateFichierUpload Le document doit avoir un champ fuuid')

    const db = await ouvrirDB()
    const store = db.transaction(STORE_DOWNLOADS, 'readwrite').store
    let docExistant = await store.get(fuuid)
    if(!docExistant) {
        if(!userId) throw new Error('updateFichierDownload Le document doit avoir un champ userId')
        docExistant = {...doc}
    } else {
        Object.assign(docExistant, doc)
    }

    docExistant.derniereModification = new Date().getTime()

    await store.put(docExistant)
}

export async function supprimerDownload(fuuid) {
    const db = await ouvrirDB()

    // await supprimerDownloadParts(fuuid, {db})

    // Supprimer entree de download
    const storeDownloads = db.transaction(STORE_DOWNLOADS, 'readwrite').store
    await storeDownloads.delete(fuuid)
}

export async function chargerDownloads(userId) {
    if(!userId) throw new Error("Il faut fournir le userId")
    const db = await ouvrirDB()
    const store = db.transaction(STORE_DOWNLOADS, 'readonly').store
    let curseur = await store.openCursor()
    const uploads = []
    while(curseur) {
        const userIdCurseur = curseur.value.userId
        if(userIdCurseur === userId) uploads.push(curseur.value)
        curseur = await curseur.continue()
    }
    return uploads
}

export async function ajouterFichierDownloadFile(fuuid, position, blob, opts) {
    opts = opts || {}
    const dechiffre = opts.dechiffre
    const db = await ouvrirDB()
    const store = db.transaction(STORE_DOWNLOADS_FICHIERS, 'readwrite').store
    const row = {
        fuuid,
        position,
        creation: new Date().getTime()
    }
    if(dechiffre === false) {
        row.blobChiffre = blob
    } else {
        row.blob = blob
    }
    await store.put(row)
}

export async function getDownload(fuuid) {
    const db = await ouvrirDB()

    // Supprimer entree de download
    const storeDownloads = db.transaction(STORE_DOWNLOADS, 'readonly').store
    const info = await storeDownloads.get(fuuid)
    
    if(!info) return false
    return info
}

export async function getDownloadComplet(fuuid) {
    const db = await ouvrirDB()

    // Supprimer entree de download
    const storeDownloads = db.transaction(STORE_DOWNLOADS, 'readonly').store
    const info = await storeDownloads.get(fuuid)
    
    if(!info) return false

    console.debug("getDownloadComplet Info ", info)

    const mimetype = info.mimetype

    const storeDownloadsFichiers = db.transaction(STORE_DOWNLOADS_FICHIERS, 'readonly').store
    const keyRange = IDBKeyRange.bound([fuuid, 0], [fuuid, Number.MAX_SAFE_INTEGER])
    let cursorFichiers = await storeDownloadsFichiers.openCursor(keyRange, 'next')
    const blobs = []
    let position = 0
    while(cursorFichiers) {
        const correlationCursor = cursorFichiers.value.fuuid
        if(correlationCursor !== fuuid) {
            throw new Error("erreur index getDownloadComplet - fuuid mismatch")
        }

        const positionBlob = correlationCursor.position
        if(positionBlob === position) {
            throw new Error("erreur index getDownloadComplet - position non triee")
        }
        const blob = cursorFichiers.value.blob

        if(blob) {
            position = positionBlob + blob.size
            blobs.push(blob)
        }

        cursorFichiers = await cursorFichiers.continue()
    }

    if(position === 0) {
        throw new Error(`Aucun contenu de fichier trouve pour ${fuuid}`)
    }

    const blobComplet = new Blob(blobs, {type: mimetype})
    // console.debug("getDownloadComplet Blob ", blobComplet)

    return { ...info, blob: blobComplet }
}

export async function getPartsDownloadChiffre(fuuid) {
    const db = await ouvrirDB()

    const storeDownloadsFichiers = db.transaction(STORE_DOWNLOADS_FICHIERS, 'readonly').store
    const keyRange = IDBKeyRange.bound([fuuid, 0], [fuuid, Number.MAX_SAFE_INTEGER])
    let cursorFichiers = await storeDownloadsFichiers.openCursor(keyRange, 'next')
    
    const parts = []
    let position = 0
    while(cursorFichiers) {
        const correlationCursor = cursorFichiers.value.fuuid
        if(correlationCursor !== fuuid) {
            throw new Error("erreur index getDownloadComplet - fuuid mismatch")
        }

        const positionBlob = correlationCursor.position
        if(positionBlob === position) {
            throw new Error("erreur index getDownloadComplet - position non triee")
        }
        const blob = cursorFichiers.value.blobChiffre

        if(blob) {
            position = cursorFichiers.value.position + blob.size
            parts.push({position: cursorFichiers.value.position, size: blob.size})
        }

        cursorFichiers = await cursorFichiers.continue()
    }

    if(position === 0) {
        //console.error("Aucun contenu de fichier trouve pour %s", fuuid)
        return false
    }

    return parts
}

export async function updatePartDownload(doc) {
    if(!doc.fuuid || doc.position === undefined) throw new Error("params fuuid/position manquants")
    const db = await ouvrirDB()
    const storeDownloadsFichiers = db.transaction(STORE_DOWNLOADS_FICHIERS, 'readwrite').store
    return await storeDownloadsFichiers.put(doc)
}
