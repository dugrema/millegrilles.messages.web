import path from 'path'
import { openDB } from 'idb'
import { base64 } from "multiformats/bases/base64"
import { makeZip } from 'client-zip'

import { chiffrage } from '@dugrema/millegrilles.reactjs/src/chiffrage'

import { supprimerCacheFuuid, getPartsDownload, streamPartsChiffrees, streamToCacheParts } from './storage'

import * as CONST_TRANSFERT from './constantes'

const { preparerDecipher } = chiffrage

var _urlDownload = '/messages/fichiers',
    _nomIdb = 'messages'

const CACHE_TEMP_NAME = 'fichiersDechiffresTmp',
      STORE_DOWNLOADS = 'downloads',
      EXPIRATION_CACHE_MS = 24 * 60 * 60 * 1000

// Globals
var _chiffrage = null

// Structure downloads : {}
var _downloadEnCours = null,
    _callbackEtatDownload = null,
    _callbackAjouterChunkIdb = null

const STATUS_ENCOURS = 2

export function down_setNomIdb(nomIdb) {
  _nomIdb = nomIdb
}

export async function down_getEtatCourant() {
  const db = await ouvrirIdb()

  const store = db.transaction(STORE_DOWNLOADS, 'readonly').objectStore(STORE_DOWNLOADS)
  let cursor = await store.openCursor()

  const downloads = []

  while(cursor) {
    const value = cursor.value
    // console.log(key, value)
    downloads.push(value)
    cursor = await cursor.continue()
  }

  // Trier pending, completes par date queuing
  downloads.sort(trierPending)

  const etat = {
      downloads,
      downloadEnCours: _downloadEnCours,
  }
  // console.debug("Retourner etat : %O", etat)
  return etat
}

function trierPending(a, b) {
  if(a===b) return 0
  const aDate = a.dateQueuing, bDate = b.dateQueuing
  return aDate.getTime() - bDate.getTime()
}

/** Fetch fichier, permet d'acceder au reader */
async function fetchAvecProgress(url, opts) {
  opts = opts || {}
  const progressCb = opts.progressCb,
        downloadEnCours = opts.downloadEnCours,
        position = opts.position || 0,
        partSize = opts.partSize,
        taille = opts.taille,
        signal = opts.signal

  var dataProcessor = opts.dataProcessor

  // const abortController = new AbortController()
  // const signal = abortController.signal
  // Note : cache no-store evite des problemes de memoire sur Firefox
  const startPosition = position || 0
  let headerContentRange = `bytes=${startPosition}-`
  let tailleTransfert = taille
  if(position !== undefined && partSize && taille) {
    let endPosition = position + partSize - 1
    if(endPosition >= taille) {
      endPosition = taille - 1
    }
    tailleTransfert = endPosition - startPosition + 1
    headerContentRange = `bytes=${startPosition}-${endPosition}/${tailleTransfert}`
  }
  // console.debug("fetch url %s header range %O", url, headerContentRange)
  const reponse = await fetch(url, {
    signal, cache: 'no-store', keepalive: false,
    headers: {'Range': headerContentRange}
  })
  const contentLengthRecu = Number(reponse.headers.get('Content-Length'))
  if(tailleTransfert && tailleTransfert !== contentLengthRecu) {
    throw new Error("mismatch content length")
  }
  
  const contentLength = taille || contentLengthRecu

  progressCb(startPosition, {})

  if(dataProcessor && dataProcessor.start) {
    // Initialiser le data processor au besoin
    const actif = await dataProcessor.start(reponse)
    if(!actif) dataProcessor = null
  }

  // Pipe la reponse pour la dechiffrer au passage
  let stream = reponse.body
  if(progressCb) {
    const progresStream = creerProgresTransformStream(progressCb, contentLength, {start: startPosition, downloadEnCours})
    stream = reponse.body.pipeThrough(progresStream)
  }

  return {
    reader: stream,
    headers: reponse.headers,
    status: reponse.status,
  }

}

async function preparerDataProcessor(opts) {
  // console.debug("preparerDataProcessor opts : %O", opts)
  opts = opts || {}
  let {password, passwordChiffre} = opts
  let blockCipher = null

  if(!password && !passwordChiffre) throw new Error("Il faut fournir opts.password ou opts.passwordChiffre")
  
  // Charger cle privee subtle, dechiffrer mot de passe
  if(!password) {
    // Dechiffrage du password - agit comme validation si subtle est utilise (on ne sauvegarde pas le password)
    password = await _chiffrage.dechiffrerCleSecrete(passwordChiffre)
  } else if(typeof(password) === 'string') {
    password = base64.decode(password)
  }

  let estActif = false
  const dataProcessor = {
    start: async params => {
      try {
        const header = opts.header
        const nonce = opts.nonce
        const cipher = await preparerDecipher(password, {...opts, header, nonce})
        estActif = true
        blockCipher = cipher
      } catch(err) {
        // Stream decipher n'est pas supporte
        throw err
      }

      return estActif
    },
    update: data => {
      if(!blockCipher) throw new Error("Data processor est inactif")
      // return data
      return blockCipher.update(data)
    },
    finish: () => {
      // if(!blockCipher) throw new Error("Data processor est inactif")
      return blockCipher.finalize()
    },
    password,
    estActif: () => estActif,
  }

  return dataProcessor
}

function createTransformStreamDechiffrage(dataProcessor) {
  // Demander un high watermark de 10 buffers de 64kb (64kb est la taille du buffer de dechiffrage)
  const queuingStrategy = new ByteLengthQueuingStrategy({ highWaterMark: 1024 * 64 * 10 });

  let tailleLue = 0

  return new TransformStream({
    async transform(chunk, controller) {
      // console.debug("TransformStream chunk size : %s", chunk?chunk.length:'null')
      if(!chunk || chunk.length === 0) return controller.error("Aucun contenu")
      tailleLue += chunk.length
      try {
        if(dataProcessor) {
          const sousBlockOutput = await dataProcessor.update(chunk)
          if(sousBlockOutput) controller.enqueue(sousBlockOutput)
        } else {
          controller.enqueue(chunk)
        }      
      } catch(err) {
        controller.error(err)
      }
    },
    async flush(controller) {
      // console.debug("createTransformStreamDechiffrage Close stream")
      if(dataProcessor) {
        const value = await dataProcessor.finish()
        const {message: chunk} = value
        if(chunk && chunk.length > 0) {
          controller.enqueue(chunk)
        }
      }
      return controller.terminate()
    }
  }, queuingStrategy)
}

const CONST_UPDATE_FREQ = 750

function creerProgresTransformStream(progressCb, size, opts) {
    opts = opts || {}

    let position = opts.start || 0

    let dernierePosition = 0,
        derniereLecture = new Date().getTime(),
        rateTransfert = 0,
        fenetreRates = []

    let timeout = null  // Timeout pour l'affichage du progres
    let afficherProgres = false
    const setAfficherProgres = () => { 
      afficherProgres = true
    }

    const afficherProgresHandler = () => { 
      afficherProgres = false
      const now = new Date().getTime()
      const intervalleLectureMs = now - derniereLecture
      rateTransfert = 1000/intervalleLectureMs * (position - dernierePosition)
      fenetreRates.push(rateTransfert)

      // Slice a 10 lectures
      if(fenetreRates.length > 10) fenetreRates = fenetreRates.slice(1, 11)

      const totalRates = fenetreRates.reduce((item, acc)=>acc+item, 0)
      rateTransfert = Math.floor(totalRates / fenetreRates.length)

      // Repositionner les curseurs
      derniereLecture = now
      dernierePosition = position

      progressCb(position, {flag: 'Download', rate: rateTransfert})
        .catch(err=>{
          console.error("setAfficherProgres Erreur ", err)
        })
        .finally(()=>{
          timeout = null
        })
    }

    return new TransformStream({
      transform(chunk, controller) {
        if(!chunk || chunk.length === 0) {
          controller.terminate()
          return
        }
        try{
          position += chunk.length
          if(!timeout) {
            timeout = setTimeout(setAfficherProgres, CONST_UPDATE_FREQ)
          } else if(afficherProgres) {
            try {
              afficherProgresHandler()
            } catch(err) {
              console.error("TransformStream Erreur afficher progres ", err)
            }
          }
          controller.enqueue(chunk)
        } catch(err) {
          console.error("Erreur controlleur : ", err)
          controller.terminate()
        }
      },
      flush(controller) { 
        // console.debug("TransformStream flush %O", controller)
        if(timeout) clearTimeout(timeout)
        controller.terminate() 
      }
    })
    // }, queuingStrategy, queuingStrategy)
}

/** 
 * Download un fichier en le separant en parts (e.g. 100 mb). 
 * Ne dechiffre pas le fichier. Supporte le resume en detectant les parts recus dans IDB. */
export async function downloadFichierParts(workers, downloadEnCours, progressCb, getAborted, opts) {
  opts = opts || {}
  progressCb = progressCb || function() {}  // Par defaut fonction vide

  if(!_callbackAjouterChunkIdb) { throw new Error('_callbackAjouterChunkIdb non initialise') }

  // console.debug("downloadFichierParts %O, Options : %O", downloadEnCours, opts)
  const DEBUG = opts.DEBUG || false
  const { downloadFichiersDao } = workers

  const {fuuid, url} = downloadEnCours
  let dechiffre = downloadEnCours.dechiffre || false

  let urlDownload = new URL(_urlDownload)
  try {
    // Verifier si URL fourni est valide/global
    urlDownload = new URL(url)
  } catch(err) {
    // Ajouter url au path
    urlDownload.pathname = path.join(urlDownload.pathname, fuuid)
    dechiffre = false
  }
  // console.debug("URL de download de fichier : %O, dechiffre : %s", urlDownload, dechiffre)

  const infoFichier = await downloadFichiersDao.getDownload(fuuid)
  let tailleFichierChiffre = infoFichier.tailleChiffre
  if(dechiffre) {
    const reponseHead = await fetch(urlDownload, {method: 'HEAD'})
    tailleFichierChiffre = Number.parseInt(reponseHead.headers.get('Content-Length'))
  } else if(!tailleFichierChiffre) {
    // Recuperer la taille du fichier chiffre
    const reponseHead = await fetch(urlDownload, {method: 'HEAD'})
    tailleFichierChiffre = Number.parseInt(reponseHead.headers.get('Content-Length'))
    infoFichier.tailleChiffre = tailleFichierChiffre
    await downloadFichiersDao.updateFichierDownload(infoFichier)
  }

  // Detecter la position courante (plus grand chunk deja recu)
  let positionPartCourant = 0
  let cacheName = dechiffre?CONST_TRANSFERT.CACHE_DOWNLOAD_DECHIFFRE:CONST_TRANSFERT.CACHE_DOWNLOAD_CHIFFRE
  const partsExistants = await getPartsDownload(fuuid, {cache: cacheName})
  // console.debug("downloadFichierParts Part existants : ", partsExistants)
  if(partsExistants && partsExistants.length > 0) {
    const partCourant = partsExistants[partsExistants.length-1]
    const partCourantPosition = partCourant.position
    positionPartCourant = partCourantPosition + (await partCourant.response.blob()).size
    console.info("downloadFichierParts Resume download a position ", positionPartCourant)
  }

  const partSize = CONST_TRANSFERT.LIMITE_DOWNLOAD_SPLIT

  const cache = await caches.open(cacheName)

  const abortControllerLocal = new AbortController()
  const intervalAbort = setInterval(async () => {
    const aborted = await getAborted()
    if(aborted) abortControllerLocal.abort()
  }, 750)

  try {
    for(let positionPart = positionPartCourant; positionPart < tailleFichierChiffre - 1; positionPart += partSize) {
      // console.debug("downloadFichierParts Position %d", positionPart)

      const {
        reader: stream, 
        headers, 
        status,
        // done,
      } = await fetchAvecProgress(
        urlDownload,
        {progressCb, downloadEnCours, position: positionPart, partSize, taille: tailleFichierChiffre, signal: abortControllerLocal.signal, DEBUG}
      )

      if(DEBUG) console.debug("Stream url %s recu (status: %d): %O", url, status, stream)

      const sizeRecu = Number(headers.get('content-length'))
      if(sizeRecu > partSize) {
        throw new Error("Reception d'une part trop grande")
      }

      if(status === 200) {
        throw new Error("HTTP code 200, devrait etre 206")
      }

      if(status>299) {
        const err = new Error(`Erreur download fichier ${url} (code ${status})`)
        err.status = status
        throw err
      }

      const fuuidPath = '/'+fuuid+'?position='+positionPart
      const response = new Response(stream, {status: 200, statusText: ''+positionPart})

      try {
        await cache.put(fuuidPath, response)
      } catch(err) {
        // S'assurer de retirer le cache
        cache.delete(fuuidPath).catch(err=>console.error("Erreur suppression cache %s : %O", fuuidPath, err))
        throw err
      }

    }  // Fin loop download parts

    progressCb(tailleFichierChiffre, {transfertComplete: true})
  } catch(err) {
    console.error("Erreur download/processing : %O", err)
    if(progressCb) progressCb(-1, {flag: 'Erreur', err: ''+err, stack: err.stack})
    throw err
  } finally {
    clearInterval(intervalAbort)
    downloadEnCours.termine = true
  }
}

export async function dechiffrerPartsDownload(workers, params, progressCb, opts) {
  opts = opts || {}
  // console.debug("dechiffrerPartsDownload params %O, opts %O", params, opts)
  const { downloadFichiersDao } = workers
  const {fuuid, password, passwordChiffre} = params
  if((!password && !passwordChiffre)) { throw new Error('Params dechiffrage absents') }

  const infoDownload = await downloadFichiersDao.getDownload(fuuid)
  // console.debug("dechiffrerPartsDownload ", infoDownload)
  const tailleChiffre = infoDownload.tailleChiffre
        // tailleDechiffre = infoDownload.taille
  // if(!tailleChiffre || !tailleDechiffre) throw new Error("Taille du fichier chiffre/dechiffre manquante")
  if(!tailleChiffre) throw new Error("Taille du fichier chiffre manquante")

  const paramsDataProcessor = {...params, password, passwordChiffre}
  // console.debug("Dechiffrer avec params : %O", paramsDataProcessor)
  const dataProcessor = await preparerDataProcessor(paramsDataProcessor)

  if(dataProcessor && dataProcessor.start) {
    // Initialiser le data processor au besoin
    const actif = await dataProcessor.start()
    if(!actif) throw new Error("Echec activation data processor")
  }

  // Creer un transform stream pour dechiffrer le fichier
  const { writable, readable } = createTransformStreamDechiffrage(dataProcessor)

  try {
    // Parcourir les parts de fichiers en ordre
    const promiseStreamParts = streamPartsChiffrees(fuuid, writable, {progressCb, tailleChiffre})
    const promiseCache = streamToCacheParts(fuuid, readable)

    // console.debug("dechiffrerPartsDownload Attente de sauvegarde sous cache pour ", fuuid)
    await Promise.all([promiseCache, promiseStreamParts])
    // console.debug("dechiffrerPartsDownload Sauvegarde completee sous cache completee. Transfert vers IDB.", fuuid)

    await supprimerCacheFuuid(fuuid, {keepDechiffre: true})
  } catch(err) {
    // Cleanup cache dechiffre
    const cacheDechiffre = await caches.open(CONST_TRANSFERT.CACHE_DOWNLOAD_DECHIFFRE)
    await cacheDechiffre.delete(`/${fuuid}`, {ignoreSearch: true})
    throw err
  }

}

async function emettreEtat(flags) {
  flags = flags || {}
  if(_callbackEtatDownload) {

      if(_downloadEnCours) {
          flags.enCoursFuuid = _downloadEnCours.fuuid
          flags.enCoursTaille = !_downloadEnCours.taille?0:_downloadEnCours.taille
          flags.enCoursLoaded = !_downloadEnCours.loaded?0:_downloadEnCours.loaded
      }

      const loadedEnCours = flags.loaded || flags.enCoursLoaded

      // Calculer information pending
      const etatCourant = await down_getEtatCourant()
      let {total, loaded, pending} = etatCourant.downloads.reduce((compteur, item)=>{
        const { taille, complete, status } = item
        if(complete) compteur.loaded += taille
        else {
          compteur.pending += 1
          if(status === STATUS_ENCOURS && item.hachage_bytes === _downloadEnCours.fuuid) {
            compteur.loaded += loadedEnCours
          }
        }
        compteur.total += taille
        return compteur
      }, {total: 0, loaded: 0, pending: 0})

      flags.total = total

      const pctFichiersEnCours = Math.floor(loaded * 100 / total)
      // console.debug("Emettre etat : pending %O, pctFichiersEnCours : %O, flags: %O", pending, pctFichiersEnCours, flags)

      _callbackEtatDownload(
          pending,
          pctFichiersEnCours,
          flags,
      )
  }
}

function ouvrirIdb() {
  return openDB(_nomIdb)
}

/** Set le chiffrage worker */
export function down_setChiffrage(chiffrage) {
  _chiffrage = chiffrage
}

export function down_setCallbackDownload(cb) {
  _callbackEtatDownload = cb
}

export function down_setCallbackAjouterChunkIdb(cb) {
  _callbackAjouterChunkIdb = cb
}

export function down_setUrlDownload(urlDownload) {
  _urlDownload = urlDownload
}

export async function down_supprimerDownloads(params) {
  params = params || {}
  const { hachage_bytes, completes, filtre } = params

  const [cache, db] = await Promise.all([caches.open(CACHE_TEMP_NAME), ouvrirIdb()])
  if(hachage_bytes) {
    // console.debug("Supprimer download/cache pour %s", hachage_bytes)
    const store = db.transaction(STORE_DOWNLOADS, 'readwrite').objectStore(STORE_DOWNLOADS)
    await store.delete(hachage_bytes)
    await cache.delete('/' + hachage_bytes, {ignoreSearch: true})
  } else if(completes === true || filtre) {
    const verifierItem = params.filtre?params.filtre:value=>value.complete
    // Supprimer tout les downloads completes
    // console.debug("down_supprimerDownloads: ouvrir curseur readwrite")
    const store = db.transaction(STORE_DOWNLOADS, 'readwrite').objectStore(STORE_DOWNLOADS)
    let cursor = await store.openCursor()
    while(cursor) {
      const { key, value } = cursor
      try {
        if(verifierItem(value)) {
          cache.delete('/' + value.hachage_bytes, {ignoreSearch: true}).catch(err=>{console.warn("Erreur suppression cache entry %s : %O", value.hachage_bytes, err)})
          await cursor.delete()
        }
      } catch(err) {
        console.warn("Erreur suppression entree cache %s : %O", key, err)
      }
      cursor = await cursor.continue()
    }
  }
  // console.debug("down_supprimerDownloads: fermer curseur readwrite")

  // Met a jour le client
  emettreEtat()
}

export async function down_supprimerDownloadsCache(fuuid) {
    // await annulerDownload(fuuid)  // Ajouter le fuuid a la liste des downloads a annuler
    const cache = await caches.open(CACHE_TEMP_NAME)
    await cache.delete('/' + fuuid, {ignoreSearch: true})
    await supprimerCacheFuuid(fuuid)
}

/** Nettoie les entrees dans le cache de download qui ne correspondent a aucune entree de la IndexedDB */
export async function cleanupCacheOrphelin() {
  const [cache, db] = await Promise.all([caches.open(CACHE_TEMP_NAME), ouvrirIdb()])
  const keysCache = await cache.keys()
  const dbKeys = await db.transaction(STORE_DOWNLOADS, 'readonly').objectStore(STORE_DOWNLOADS).getAllKeys()
  // console.debug("DB Keys : %O", dbKeys)

  for(let idx in keysCache) {
    const req = keysCache[idx]
    // console.debug("KEY %s", req.url)
    const urlKey = new URL(req.url)
    const fuuid = urlKey.pathname.split('/').pop()
    // console.debug("FUUID : %O", fuuid)
    if(!dbKeys.includes(fuuid)) {
      // console.debug("Cle cache inconnue, on va supprimer %s", fuuid)
      cache.delete(req).catch(err=>{console.warn("Erreur suppression entree cache %s", fuuid)})
    }
  }

}

/** Effectue l'entretie du cache et IndexedDb */
export async function down_entretienCache() {
  // console.debug("Entretien cache/idb de download")
  
  // Cleanup fichiers downloades de plus de 24h
  const dateExpiration = new Date().getTime() - EXPIRATION_CACHE_MS
  // const dateExpiration = new Date().getTime() - (60 * 1000)
  await down_supprimerDownloads({
    filtre: item => item.dateComplete.getTime() < dateExpiration
  })
  
  // Cleanup entrees de download cache inutilisees
  await cleanupCacheOrphelin()
}

export async function genererFichierZip(workers, downloadInfo, getAborted, progressCb) {
  // console.debug("genererFichierZip Downloads completes, generer le zip pour ", downloadInfo)
  const { downloadFichiersDao } = workers

  const { fuuids } = downloadInfo

  const fuuidZip = downloadInfo.fuuid

  const nodes = downloadInfo.root.nodes
  let tailleFichiers = 0
  for await (const info of parcourirRepertoireDansZipRecursif(workers, nodes, [], {operation: 'getFuuid', progressCb})) {
    // console.debug("genererFichierZip Prepass fichier : ", info)
    tailleFichiers += info.taille
  }
  // console.debug("Mettre %d bytes dans le zip", tailleFichiers)
  await progressCb(0, {tailleTotale: tailleFichiers})

  // Parcourir tous les repertoires, streamer les fichiers dans le stream
  const fuuidsTraites = new Set()
  const resultatZip = makeZip(parcourirRepertoireDansZipRecursif(workers, nodes, [], {fuuidsSet: fuuidsTraites, getAborted, progressCb}))

  const headersModifies = new Headers()
  headersModifies.set('content-type', 'application/zip')
  headersModifies.set('content-disposition', `attachment; filename="${encodeURIComponent('millegrilles.zip')}"`)

  // Sauvegarder blob 
  await streamToCacheParts(fuuidZip, resultatZip)

  // Verifier si tous les fichiers ont ete traites
  const fuuidsManquants = []
  for(const fuuid of fuuids) {
    if(!fuuidsTraites.has(fuuid)) fuuidsManquants.push(fuuid)
  }
  if(fuuidsManquants.length > 0) {
    console.error("Fuuids traites: %O, manquants du zip : ", fuuidsTraites, fuuidsManquants)
    throw new Error(`${fuuidsManquants.length} fichiers manquants dans le ZIP`)
  }

  // Cleanup downloads individuels - on garde juste le ZIP
  for await (const info of parcourirRepertoireDansZipRecursif(workers, nodes, [], {operation: 'getFuuid', progressCb})) {
      const fuuid = info.fuuid
      // console.debug("Supprimer download fuuid %s", fuuid)
      await downloadFichiersDao.supprimerDownload(fuuid)
        .catch(err=>console.error("genererFichierZip Erreur suppression download IDB %s : %O", fuuid, err))
      await supprimerCacheFuuid(fuuid)
        .catch(err=>console.error("genererFichierZip Erreur suppression download cache %s : %O", fuuid, err))
  }
}

async function* ajouterRepertoireDansZip(workers, node, parents, opts) {
  // console.debug("Ajouter path %O/%s", parents.join('/'), node.nom)

  // Ajouter le node dans le zip

  const pathAjoute = [...parents, node.nom]
  const nodes = node.nodes
  if(nodes) {
      // console.debug("Sous repertoire ", pathAjoute)
      for await (const fichier of parcourirRepertoireDansZipRecursif(workers, node.nodes, pathAjoute, opts)) {
          // console.debug("ajouterRepertoireDansZip Node ", fichier)
          yield fichier
      }
  }
}

async function* parcourirRepertoireDansZipRecursif(workers, nodes, parents, opts) {
  opts = opts || {}
  const operation = opts.operation || 'stream'
  const fuuidsSet = opts.fuuidsSet
  const getAborted = opts.getAborted
  const progressCb = opts.progressCb
  // console.debug("streamRepertoireDansZipRecursif parents ", parents)
  let bytesTraites = 0
  for await (const node of nodes) {
      if(getAborted && await getAborted()) {
        throw new Error("abort")
      }

      if(node.type_node === 'Fichier') {
          const fuuid = node.fuuid
          let nomFichier = node.nom
          if(parents && parents.length > 0) {
              nomFichier = parents.join('/') + '/' + node.nom
          }
          
          if(operation === 'stream') {
              // Ouvrir le stream pour le fuuid
              const partsDechiffre = await getPartsDownload(fuuid, {cache: CONST_TRANSFERT.CACHE_DOWNLOAD_DECHIFFRE})
              if(partsDechiffre.length === 0) {
                throw new Error(`fichier ${fuuid} manquant`)
              }
              const blobParts = []
              for await(const part of partsDechiffre) {
                const blob = await part.response.blob()
                blobParts.push(blob)
              }
              const blobFichier = new Blob(blobParts)
              bytesTraites += blobFichier.size
              if(progressCb) await progressCb(bytesTraites)
        
              // console.debug("parcourirRepertoireDansZipRecursif Conserver fichier %s (parents : %O)", nomFichier, parents)
              yield {name: nomFichier, input: blobFichier}
          } else if(operation === 'getFuuid') {
              // console.debug("parcourirRepertoireDansZipRecursif getFuuid nom: %s, fuuid: %s, node:%O", nomFichier, fuuid, node)
              const version_courante = node.version_courante || {}
              yield {name: nomFichier, fuuid, taille: version_courante.taille}
          }

          if(fuuidsSet) fuuidsSet.add(fuuid)
      } else {
          // Sous-repertoire
          // console.debug("streamRepertoireDansZipRecursif Sous repertoire ", node.nom)
          for await (const sousNode of ajouterRepertoireDansZip(workers, node, parents, opts)) {
              yield sousNode
          }
      }
  }
}
