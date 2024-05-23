import * as CONST_TRANSFERT from '../transferts/constantes'
import {getPartsDownload} from '../transferts/storage'

function setup(workers) {
    return {
        clean,
        downloadCache(fuuid, opts) {
            return downloadCache(workers, fuuid, opts)
        },

        // Remplacement pour getFichierChiffre
        getUrlFuuid,
        getCleSecrete(cle_id, opts) {
            opts = opts || {}
            return getCleSecrete(workers, cle_id, opts)
        },
    }
}

export default setup

function getUrlFuuid(fuuid, opts) {
    opts = opts || {}
    const jwt = opts.jwt

    const url = new URL(window.location.href)
    if(jwt) {
        // Mode streaming
        url.pathname = `/messages/streams/${fuuid}`
        url.searchParams.append('jwt', jwt)
    } else {
        // Fichiers (defaut)
        url.pathname = `/messages/fichiers/${fuuid}`
    }

    return url.href
}

async function getCleSecrete(workers, cle_id, opts) {
    opts = opts || {}
    if(!cle_id) throw new Error('dechiffrer Fournir cle_id ou cle_secrete+header')

    const { connexion, usagerDao, chiffrage } = workers
    const local = opts || false

    try {
        const cleFichier = await usagerDao.getCleDechiffree(cle_id)
        // La cle existe localement
        if(cleFichier) return cleFichier
    } catch(err) {
        console.error("Erreur acces usagerDao ", err)
    }

    if(local) return  // La cle n'existe pas localement, abort

    const reponse = await connexion.getClesFichiers([cle_id], {estCleFichier: true})

    const cleFichier = reponse.cles[cle_id]

    const cleSecrete = await chiffrage.dechiffrerCleSecrete(cleFichier.cle)
    cleFichier.cleSecrete = cleSecrete
    cleFichier.cle_secrete = cleSecrete  // Nouvelle approche

    // Sauvegarder la cle pour reutilisation
    usagerDao.saveCleDechiffree(cle_id, cleSecrete, cleFichier)
        .catch(err=>console.warn("Erreur sauvegarde cle dechiffree %s dans la db locale", err))

    return cleFichier
}

async function clean(urlBlobPromise) {
    try {
        const urlBlob = await urlBlobPromise
        // console.debug("Cleanup blob %s", urlBlob)
        URL.revokeObjectURL(urlBlob)
    } catch(err) {
        console.debug("Erreur cleanup URL Blob : %O", err)
    }
}

export async function downloadCache(workers, fuuid, opts) {
    opts = opts || {}
    const { downloadFichiersDao } = workers
    if(fuuid.currentTarget) fuuid = fuuid.currentTarget.value
    console.debug("Download fichier : %s = %O", fuuid, opts)

    const resultat = await downloadFichiersDao.getDownload(fuuid)
    const taille = resultat.taille

    if(resultat && resultat.blob) {
        promptSaveFichier(resultat.blob, opts)
    } else {
        const parts = await getPartsDownload(fuuid, {cache: CONST_TRANSFERT.CACHE_DOWNLOAD_DECHIFFRE})
        console.debug('downloadCache Parts : ', parts)
        // console.debug("Cache fichier : %O", cacheFichier)
        if(parts && parts.length > 0) {
            // promptSaveFichier(await cacheFichier.blob(), opts)
            const blobs = []
            for(const part of parts) {
                const blob = await part.response.blob()
                blobs.push(blob)
            }
            const blobFichier = new Blob(blobs)
            if(taille && blobFichier.size !== taille) throw new Error('mismatch taille fichier')
            promptSaveFichier(blobFichier, opts)
        } else {
            console.warn("Fichier '%s' non present dans le cache", fuuid)
        }
    }
}

function promptSaveFichier(blob, opts) {
    opts = opts || {}
    const filename = opts.filename
    let objectUrl = null
    try {
        objectUrl = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        if (filename) a.download = filename
        if (opts.newTab) a.target = '_blank'
        a.click()
    } finally {
        if (objectUrl) {
            try {
                URL.revokeObjectURL(objectUrl)
            } catch (err) {
                console.debug("Erreur revokeObjectURL : %O", err)
            }
        }
    }
}
