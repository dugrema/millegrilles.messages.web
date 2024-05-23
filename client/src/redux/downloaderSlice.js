import { createSlice, isAnyOf, createListenerMiddleware } from '@reduxjs/toolkit'
import { proxy } from 'comlink'

import {ETAT_PRET, ETAT_COMPLETE, ETAT_DOWNLOAD_ENCOURS, ETAT_DOWNLOAD_SUCCES_CHIFFRE, ETAT_DOWNLOAD_SUCCES_DECHIFFRE, ETAT_ECHEC} from '../transferts/constantes'

import * as CONST_TRANSFERT from '../transferts/constantes'

const SLICE_NAME = 'downloader'
      
const CONST_LOCALSTORAGE_PAUSEDOWNLOADS = 'downloadsPaused'

const initialState = {
    liste: [],                  // Liste de fichiers en traitement (tous etats confondus)
    userId: '',                 // UserId courant, permet de stocker plusieurs users localement
    progres: null,              // Pourcentage de progres en int
    completesCycle: [],         // Conserve la liste des uploads completes qui restent dans le total de progres
    enCours: false,             // True si download en cours
    annulerFuuid: [],           // Liste de downloads a annuler
    autoResumeMs: 20_000,       // Intervalle en millisecondes pour l'activation de l'auto-resume
    autoResumeBlocked: false,   // Blockage de l'auto-resume en cas d'erreur specifique
    downloadsPaused: 'true'===window.localStorage.getItem(CONST_LOCALSTORAGE_PAUSEDOWNLOADS),  // Pause le download
}

// Actions

function setUserIdAction(state, action) {
    state.userId = action.payload
}

function setDownloadsAction(state, action) {
    // Merge listes
    const listeDownloads = action.payload
    const listeExistanteMappee = state.liste.reduce((acc, item)=>{
        acc[item.fuuid] = item
        return acc
    }, {})

    // Retirer les uploads connus
    const nouvelleListe = listeDownloads.filter(item=>!listeExistanteMappee[item.fuuid])
    
    // Push les items manquants a la fin de la liste
    nouvelleListe.forEach(item=>state.liste.push(item))
    
    const { pourcentage } = calculerPourcentage(state.liste, [])

    state.liste.sort(sortDateCreation)
    state.completesCycle = []
    state.progres = pourcentage
}

function pushDownloadAction(state, action) {
    const docDownload = action.payload

    // console.debug("pushDownloadAction payload : ", docDownload)
    state.liste.push(docDownload)

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function pushGenererZipAction(state, action) {
    const infoGenererZip = action.payload
    // console.debug("pushGenererZipAction payload : ", infoGenererZip)

    infoGenererZip.etat = ETAT_PRET
    infoGenererZip.dateCreation = new Date().getTime()

    state.liste.push(infoGenererZip)
}

function updateDownloadAction(state, action) {
    const docDownload = action.payload
    const fuuid = docDownload.fuuid

    // Trouver objet existant
    const infoDownload = state.liste.filter(item=>item.fuuid === fuuid).pop()

    // Detecter changement etat a succes
    if([ETAT_DOWNLOAD_SUCCES_CHIFFRE, ETAT_DOWNLOAD_SUCCES_DECHIFFRE].includes(docDownload.etat)) {
        state.completesCycle.push(fuuid)
    }

    if(!infoDownload) state.liste.push(docDownload)    // Append
    else Object.assign(infoDownload, docDownload)       // Merge

    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function continuerDownloadAction(state, action) {
    const docDownload = action.payload

    window.localStorage.setItem(CONST_LOCALSTORAGE_PAUSEDOWNLOADS, 'false')

    if(state.autoResumeBlocked) {
        clearTimeout(state.autoResumeBlocked)  // Retirer le timeout pour empecher cedule auto-resume
        state.autoResumeBlocked = false
    }
    state.downloadsPaused = false

    // docDownload peut etre null si on fait juste redemarrer le middleware
    if(docDownload) {
        const fuuid = docDownload.fuuid

        // Trouver objet existant
        const infoDownload = state.liste.filter(item=>item.fuuid === fuuid).pop()

        console.debug("continuerDownloadAction ", docDownload)

        if(!infoDownload) state.liste.push(docDownload)    // Append
        else Object.assign(infoDownload, docDownload)       // Merge

        const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
        state.progres = pourcentage
    }
}

function retirerDownloadAction(state, action) {
    const fuuid = action.payload
    state.liste = state.liste.filter(item=>item.fuuid !== fuuid)
    const { pourcentage } = calculerPourcentage(state.liste, state.completesCycle)
    state.progres = pourcentage
}

function clearDownloadsAction(state, action) {
    state.liste = []
    state.progres = null
}

function supprimerDownloadAction(state, action) {
    const fuuid = action.payload
    state.liste = state.liste.filter(item=>item.fuuid !== fuuid)
}

function arretDownloadAction(state, action) {
    // Declenchement du middleware (via trigger)
}

function clearCycleDownloadAction(state, action) {
    state.completesCycle = []
}

function setEnCoursAction(state, action) {
    state.enCours = action.payload
}

function bloquerAutoResumeAction(state, action) {
    const timeout = action.payload
    state.autoResumeBlocked = timeout
}

function debloquerAutoResumeAction(state, action) {
    state.autoResumeBlocked = false
}

function pauseDownloadsAction(state, action) {
    state.downloadsPaused = true

    window.localStorage.setItem(CONST_LOCALSTORAGE_PAUSEDOWNLOADS, 'true')

    if(state.autoResumeBlocked) {
        // Retirer le timeout pour empecher declenchement du auto-resume
        clearTimeout(state.autoResumeBlocked)
        state.autoResumeBlocked = false
    }
}

function resumeDownloadsAction(state, action) {
    state.downloadsPaused = false
    window.localStorage.setItem(CONST_LOCALSTORAGE_PAUSEDOWNLOADS, 'false')
}

const downloaderSlice = createSlice({
    name: SLICE_NAME,
    initialState,
    reducers: {
        setUserId: setUserIdAction,
        setDownloads: setDownloadsAction,
        pushDownload: pushDownloadAction,
        continuerDownload: continuerDownloadAction,
        retirerDownload: retirerDownloadAction,
        clearDownloads: clearDownloadsAction,
        supprimerDownload: supprimerDownloadAction,
        arretDownload: arretDownloadAction,
        clearCycleDownload: clearCycleDownloadAction,
        updateDownload: updateDownloadAction,
        pushGenererZip: pushGenererZipAction,
        setEnCours: setEnCoursAction, 
        bloquerAutoResume: bloquerAutoResumeAction,
        debloquerAutoResume: debloquerAutoResumeAction,
        pauseDownloads: pauseDownloadsAction,
        resumeDownloads: resumeDownloadsAction,
    }
})

export const { 
    setUserId, setDownloads, 
    pushDownload, continuerDownload, retirerDownload, arretDownload,
    clearDownloads, clearCycleDownload,
    updateDownload, supprimerDownload,
    pushGenererZip, setEnCours,
    pauseDownloads, resumeDownloads, bloquerAutoResume, debloquerAutoResume,
} = downloaderSlice.actions
export default downloaderSlice.reducer

// Thunks

export function ajouterDownload(workers, docDownload) {
    return (dispatch, getState) => traiterAjouterDownload(workers, docDownload, dispatch, getState)
}

async function traiterAjouterDownload(workers, docDownload, dispatch, getState) {
    const { downloadFichiersDao, clesDao } = workers
    
    console.debug("traiterAjouterDownload payload : ", docDownload)
    
    const userId = getState()[SLICE_NAME].userId
    if(!userId) throw new Error("userId n'est pas initialise dans downloaderSlice")

    const version_courante = docDownload.version_courante || {}
    const fuuid = docDownload.fuuidDownload || docDownload.fuuid || version_courante.fuuid
    const fuuidCle = version_courante.fuuid || fuuid
    const taille = version_courante.taille

    // Verifier s'il y a assez d'espace pour downloader le fichier
    // if('storage' in navigator) {
    //     const estimate = await navigator.storage.estimate()
    //     console.debug("traiterAjouterDownload storage estimate ", estimate)
    //     const quota = estimate.quota
    //     if(quota && quota < taille) {
    //         const error = new Error(
    //             `Espace disponible dans le navigateur insuffisant : 
    //             requis ${Math.floor(taille/CONST_1MB)} MB, 
    //             disponible ${quota/CONST_1MB} MB`
    //         )
    //         error.code = 1
    //         error.tailleTotale = taille
    //         error.tailleDisponible = quota
    //         throw error
    //     }
    // }

    const infoDownload = getState()[SLICE_NAME].liste.filter(item=>item.fuuid === fuuid).pop()
    // console.debug("ajouterDownloadAction fuuid %s info existante %O", fuuid, infoDownload)
    if(!infoDownload) {
        // Ajouter l'upload, un middleware va charger le reste de l'information
        // console.debug("Ajout upload %O", correlation)

        let informationDechiffrage = null
        if(version_courante.cle_id) {
            // Dechiffrage V2+
            informationDechiffrage = {
                cle_id: version_courante.cle_id,
                format: version_courante.format,
                nonce: version_courante.nonce,
                verification: version_courante.verification,
            }
            // Fetch pour cache (ne pas stocker dans redux)
            await clesDao.getCles([version_courante.cle_id], {estCleFichier: true})
        } else {
            // Approche obsolete, aller chercher information de dechiffrage symmetrique
            // avec la cle.
            const cles = await clesDao.getCles([fuuidCle])
            // console.debug("traiterAjouterDownload Cles recues ", cles)
            const cle = Object.values(cles).pop()
            let nonce = cle.nonce
            if(cle.header) nonce = cle.header.slice(1)  // Retirer le 'm' multibase
            informationDechiffrage = {
                cle_id: fuuidCle,
                format: cle.format,
                nonce,
            }
        }

        const nouveauDownload = {
            ...docDownload,
            fuuid,
            fuuidCle,
            taille,
            userId,
            dechiffre: docDownload.url?true:false,
            etat: ETAT_PRET,
            dateCreation: new Date().getTime(),
            dechiffrage: informationDechiffrage,
        }

        // Conserver le nouveau download dans IDB
        // console.debug("ajouterDownloadAction Ajouter download dans IDB ", nouveauDownload)
        await downloadFichiersDao.updateFichierDownload(nouveauDownload)

        dispatch(pushDownload(nouveauDownload))
    } else {
        throw new Error(`Download ${fuuid} existe deja`)
    }    
}

/** Creer un nouveau download de repertoire par cuuid. Genere un fichier ZIP. */
export function ajouterZipDownload(workers, cuuid) {
    return (dispatch, getState) => traiterAjouterZipDownload(workers, cuuid, dispatch, getState)
}

async function traiterAjouterZipDownload(workers, params, dispatch, getState) {
    const { connexion, chiffrage, downloadFichiersDao, clesDao } = workers
    let { cuuid, contactId } = params
    
    // console.debug("traiterAjouterZipDownload cuuid : %s, selection : %O (contactId: %s)", cuuid, selection, contactId)
    
    const userId = getState()[SLICE_NAME].userId
    if(!userId) throw new Error("userId n'est pas initialise dans downloaderSlice")

    // Charger statistiques cuuid, liste de fichiers/dossiers
    if(cuuid === '') cuuid = null
    const reponseStructure = await connexion.getStructureRepertoire(cuuid, contactId)
    // console.debug("Reponse structure : ", reponseStructure)
    if(reponseStructure.ok === false) {
        throw new Error("Erreur preparation ZIP : ", reponseStructure.err)
    }

    // Batir la hierarchie du repertoire
    let tailleTotale = 0
    const nodeParTuuid = {}, nodeParCuuidParent = {}, root = [], fuuidsCles = []
    reponseStructure.liste.forEach(item=>{
        nodeParTuuid[item.tuuid] = item

        // Ajouter flag noSave=true pour le processus de download. Evite pop-up de sauvegarde.
        item.noSave = true

        if(item.type_node === 'Fichier') {
            // Extraire version courante (idx: 0)
            const version = item.versions[0]
            if(version) {
                tailleTotale += version.taille
            }

            // Ancienne version de chiffrage (obsolete)
            let fuuid = null
            if(item.fuuids_versions) {
                fuuid = item.fuuids_versions[0]
                item.fuuid = fuuid  // Set pour download
            }

            // Support nouvelle version chiffrage (V2) et ancienne obsolete
            let cle_id = fuuid
            if(version && version.cle_id) {
                cle_id = version.cle_id

                // Transferer champs de dechiffrage V2
                const version_courante = item.version_courante || {}
                item.version_courante = version_courante
                version_courante.fuuid = fuuid
                version_courante.cle_id = cle_id
                version_courante.format = version.format
                version_courante.nonce = version.nonce
                version_courante.verificaton = version.verification
            }
            fuuidsCles.push(cle_id)
        } else {
            // Collection ou repertoire
            const metadata = item.metadata
            const cle_id = metadata.cle_id || metadata.ref_hachage_bytes
            fuuidsCles.push(cle_id)
        }

        if(item.path_cuuids && item.path_cuuids[0] !== cuuid) {
            const cuuidParent = item.path_cuuids[0]
            let nodes = nodeParCuuidParent[cuuidParent]
            if(!nodes) {
                nodes = []
                nodeParCuuidParent[cuuidParent] = nodes
            }
            nodes.push(item)
        } else {
            // Ajouter sous-repertoire (si ce n'est pas le repertoire de base)
            if(item.tuuid !== cuuid) root.push(item)
        }
    })

    for (const cuuidLoop of Object.keys(nodeParCuuidParent)) {
        const nodes = nodeParCuuidParent[cuuidLoop]
        const parent = nodeParTuuid[cuuidLoop]
        // console.debug("Wiring sous cuuid parent %s (%O) nodes %O", cuuidLoop, parent, nodes)
        if(parent) {
            parent.nodes = nodes
        } else {
            console.warn("Aucun lien pour parent %s pour %O, fichiers ignores", cuuidLoop, nodes)
            // Retirer le download des tuuids 
            nodes.forEach(item=>{
                if(item.tuuid !== cuuid) {
                    delete nodeParTuuid[item.tuuid]
                }
            })
        }
    }

    // Preparer toutes les cles (tous les tuuids incluant repertoires)
    const cles = await clesDao.getCles(fuuidsCles, {partage: !!contactId})
    // console.debug("Cles chargees : %O", cles)

    // Dechiffrer le contenu des tuuids. On a besoin du nom (fichiers et repertoires)
    const fuuidsFichiersDownloadSet = new Set()
    for await(const tuuid of Object.keys(nodeParTuuid)) {
        const item = nodeParTuuid[tuuid]
        const metadata = item.metadata

        let cle_id = metadata.cle_id || metadata.ref_hachage_bytes

        if(item.fuuids_versions) {
            // C'est un fichier a downloader
            const fuuid = item.fuuids_versions[0]
            if(!fuuid) {
                console.warn("Aucun fuuid pour %s - SKIP", tuuid)
                continue
            }
            fuuidsFichiersDownloadSet.add(fuuid)
        }

        const cle = cles[cle_id]
        if(!cle) {
            console.warn("Aucune cle pour cle_id %s - SKIP", cle_id)
            continue
        }

        // console.debug("Dechiffrer %O avec cle %O", metadata, cle)
        const metaDechiffree = await chiffrage.chiffrage.dechiffrerChampsV2({...cle, ...metadata}, cle.cleSecrete)
        // console.debug("Contenu dechiffre : ", metaDechiffree)
        // Ajout/override champs de metadonne avec contenu dechiffre
        Object.assign(item, metaDechiffree)
    }

    // console.debug("Contenu fichier ZIP : ", root)

    // Ajouter tous les fichiers a downloader dans la Q de downloader et demarrer
    for await(const tuuid of Object.keys(nodeParTuuid)) {
        const item = nodeParTuuid[tuuid]
        if(item.fuuids_versions) {
            // console.warn("SKIP download - TO DO fix me")
            try {
                await dispatch(ajouterDownload(workers, item))
            } catch(err) {
                console.warn("Erreur ajout fuuid %s dans downloads - on assume qu'il existe deja : %O", item.fuuid, err)
            }
        }
    }

    const nodeRoot = nodeParTuuid[cuuid] || {}
    nodeRoot.nodes = root

    // console.debug("traiterAjouterZipDownload nodeParTuuid : %O, nodeRoot : ", nodeParTuuid, nodeRoot)

    // Creer un fuuid artificiel pour supporter la meme structure que le download de fichiers
    let fuuidZip = 'zip/root'
    if(cuuid) {
        fuuidZip = 'zip/' + cuuid
    }

    let nomArchive = 'millegrilles.zip'
    if(nodeRoot.nom) nomArchive = nodeRoot.nom + '.zip'

    const listeFuuidsFichiers = []
    for(const fuuid of fuuidsFichiersDownloadSet) {
        listeFuuidsFichiers.push(fuuid)
    }

    const docGenererZip = {
        fuuid: fuuidZip,
        cuuid,
        userId,
        root: nodeRoot,
        genererZip: true,
        nom: nomArchive,
        mimetype: 'application/zip',
        fuuids: listeFuuidsFichiers,
    }

    // Conserver le nouveau download dans IDB
    // console.debug("Doc generer zip : %O", docGenererZip)
    await downloadFichiersDao.updateFichierDownload(docGenererZip)
    // Inserer dans la Q de traitement
    dispatch(pushGenererZip(docGenererZip))
}

export function arreterDownload(workers, fuuid) {
    return (dispatch, getState) => traiterArreterDownload(workers, fuuid, dispatch, getState)
}

async function traiterArreterDownload(workers, fuuid, dispatch, getState) {
    // console.debug("traiterCompleterDownload ", fuuid)
    const { downloadFichiersDao, transfertDownloadFichiers } = workers
    const state = getState()[SLICE_NAME]
    const download = state.liste.filter(item=>item.fuuid===fuuid).pop()
    if(download) {
        // Arreter et retirer download state (interrompt le middleware au besoin)
        dispatch(supprimerDownload(fuuid))

        await transfertDownloadFichiers.down_supprimerDownloadsCache(fuuid)

        // Supprimer le download dans IDB, cache
        await downloadFichiersDao.supprimerDownload(fuuid)
    }
}

export function completerDownload(workers, fuuid) {
    return (dispatch, getState) => traiterCompleterDownload(workers, fuuid, dispatch, getState)
}

async function traiterCompleterDownload(workers, fuuid, dispatch, getState) {
    // console.debug("traiterCompleterDownload ", fuuid)
    const { downloadFichiersDao, traitementFichiers } = workers
    const state = getState()[SLICE_NAME]
    const download = state.liste.filter(item=>item.fuuid===fuuid).pop()
    if(download) {
        // console.debug('traiterCompleterDownload ', download)

        const downloadCopie = {...download}
        downloadCopie.etat = ETAT_COMPLETE
        downloadCopie.dateConfirmation = new Date().getTime()
        downloadCopie.tailleCompletee = downloadCopie.taille

        // Maj contenu download
        await downloadFichiersDao.updateFichierDownload(downloadCopie)

        // Maj redux state
        dispatch(updateDownload(downloadCopie))

        const noSave = downloadCopie.noSave || downloadCopie.modeVideo || false

        if(!noSave) {
            try {
                // Prompt sauvegarder
                const fuuid = download.fuuid,
                      filename = download.nom
                await traitementFichiers.downloadCache(fuuid, {filename})
            } catch(err) {
                console.warn("Erreur prompt pour sauvegarder fichier downloade ", err)
            }
        } else {
            // console.debug("Skip prompt sauvegarde %O", download)
        }
    }
}

export function supprimerDownloadsParEtat(workers, etat) {
    return (dispatch, getState) => traiterSupprimerDownloadsParEtat(workers, etat, dispatch, getState)
}

async function traiterSupprimerDownloadsParEtat(workers, etat, dispatch, getState) {
    const { downloadFichiersDao, transfertDownloadFichiers } = workers
    const downloads = getState()[SLICE_NAME].liste.filter(item=>item.etat === etat)
    for await (const download of downloads) {
        const fuuid = download.fuuid

        // Arreter et retirer download state (interrompt le middleware au besoin)
        dispatch(supprimerDownload(fuuid))

        await transfertDownloadFichiers.down_supprimerDownloadsCache(fuuid)

        // Supprimer le download dans IDB, cache
        await downloadFichiersDao.supprimerDownload(fuuid)
    }
}

// Middleware
export function downloaderMiddlewareSetup(workers) {
    const uploaderMiddleware = createListenerMiddleware()
    
    uploaderMiddleware.startListening({
        matcher: isAnyOf(ajouterDownload, pushGenererZip, setDownloads, continuerDownload, resumeDownloads),
        effect: (action, listenerApi) => downloaderMiddlewareListener(workers, action, listenerApi)
    }) 
    
    return uploaderMiddleware
}

async function downloaderMiddlewareListener(workers, action, listenerApi) {
    // console.debug("downloaderMiddlewareListener running effect, action : %O, listener : %O", action, listenerApi)

    {
        const state = listenerApi.getState()[SLICE_NAME]
        if(state.downloadsPaused) return  // Download en pause
    }

    const abortController = new AbortController()

    await listenerApi.unsubscribe()
    listenerApi.dispatch(setEnCours(true))
    try {
        // Reset liste de fichiers completes utilises pour calculer pourcentage upload
        listenerApi.dispatch(clearCycleDownload())

        const task = listenerApi.fork( forkApi => tacheDownload(workers, listenerApi, forkApi, abortController) )
        // console.debug("Task : ", task)
        const stopAction = listenerApi.condition(arretDownload.match).then(params=>{
            // console.debug("Annulation manuelle params : %O", params)
            abortController.abort('Annulation manuelle')
            task.cancel()
            // console.debug("Task cancelled")
        })
        await Promise.race([task.result, stopAction])
        // await task.result

        // console.debug("downloaderMiddlewareListener Task %O\nstopAction %O", task, stopAction)
        // Attendre fin de la tache en cas d'annulation        
        await task.result.catch(err=>console.error("Erreur task : %O", err))
        // console.debug("downloaderMiddlewareListener Task completee")
    } finally {
        listenerApi.dispatch(setEnCours(false))
        await listenerApi.subscribe()
    }

    // Verifier si on doit declencher un trigger d'auto-resume apres un certain delai
    {
        if(action === resumeDownloadsAction.name) {
            console.debug("downloaderMiddlewareListener Declencher suite a resume action")
            declencherRedemarrage(listenerApi.dispatch, listenerApi.getState)
        } else {
            const state = listenerApi.getState()[SLICE_NAME]
            // console.debug("Verifier si on redemarre automatiquement : %O", state)
            if(state.liste) {
                const echecTransfert = state.liste.reduce((acc, item)=>{
                    if(acc) return acc
                    if(item.etat === CONST_TRANSFERT.ETAT_ECHEC) return item
                    return false
                }, false)
                // console.debug("Resultat echecTransfert ", echecTransfert)
                if(echecTransfert && state.autoResumeMs && !state.autoResumeBlocked) {
                    console.info("Au moins un transfert en echec (%O), on cedule le redemarrage", echecTransfert)
                    const timeout = setTimeout(()=>declencherRedemarrage(listenerApi.dispatch, listenerApi.getState), state.autoResumeMs)
                    listenerApi.dispatch(bloquerAutoResume(timeout))
                }
            }
        }
    }
}

function declencherRedemarrage(dispatch, getState) {
    dispatch(debloquerAutoResume())
    const state = getState()[SLICE_NAME]
    const fichier = state.liste.reduce((acc, item)=>{
        if(acc) return acc
        if(item.etat === CONST_TRANSFERT.ETAT_ECHEC) return item
        return false
    }, false)
    if(fichier) {
        console.info("declencherRedemarrage Transfert de %O", fichier)
        const fichierCopie = {...fichier, etat: CONST_TRANSFERT.ETAT_PRET}
        dispatch(continuerDownload(fichierCopie))
    } else {
        console.debug("Il ne reste aucun fichiers a transferer")
    }
}

async function tacheDownload(workers, listenerApi, forkApi, abortController) {
    // console.debug("Fork api : %O", forkApi)
    const dispatch = listenerApi.dispatch

    let nextDownload = getProchainDownload(listenerApi.getState()[SLICE_NAME].liste)

    // const cancelToken = {cancelled: false}
    // const aborted = event => {
    //     console.debug("tacheDownload.aborted Event recu ", event)
    //     cancelToken.cancelled = true
    // }
    // forkApi.signal.onabort = aborted

    if(!nextDownload) return  // Rien a faire

    const getAborted = proxy(()=>abortController.signal.aborted)

    // Commencer boucle d'upload
    while(nextDownload) {
        // console.debug("Next download : %O", nextDownload)
        const fuuid = nextDownload.fuuid
        try {
            if(nextDownload.genererZip === true) {
                // Generer un fichier zip
                await genererFichierZip(workers, dispatch, nextDownload, getAborted)
            } else {
                await downloadFichier(workers, dispatch, nextDownload, getAborted)
            }
        } catch (err) {
            console.error("Erreur tache download fuuid %s: %O", fuuid, err)
            marquerDownloadEtat(workers, dispatch, fuuid, {etat: CONST_TRANSFERT.ETAT_ECHEC})
                .catch(err=>console.error("Erreur marquer download echec %s : %O", fuuid, err))
            throw err
        }

        // Trouver prochain download
        if(listenerApi.getState()[SLICE_NAME].downloadsPaused) {
            // console.debug("tacheDownload Downloads paused, on arrete le traitement")
            abortController.abort('Downloads paused')  // Annule le transfert
            return
        } else if (await getAborted()) {
            console.debug("tacheDownload annulee")
            marquerDownloadEtat(workers, dispatch, fuuid, {etat: CONST_TRANSFERT.ETAT_ECHEC})
                .catch(err=>console.error("Erreur marquer download echec %s : %O", fuuid, err))
            return
        }
        nextDownload = getProchainDownload(listenerApi.getState()[SLICE_NAME].liste)
    }
}

async function genererFichierZip(workers, dispatch, downloadInfo, getAborted) {
    const transfertDownloadFichiers = workers.transfertDownloadFichiers
    const fuuidZip = downloadInfo.fuuid,
          userId = downloadInfo.userId,
          fuuids = downloadInfo.fuuids

    const frequenceUpdate = 500
    let dernierUpdate = 0
    const progressCb = proxy( (tailleCompletee, opts) => {
        opts = opts || {}
        const champ = opts.champ || 'tailleCompletee'
        const tailleTotale = opts.tailleTotale
        let etat = ETAT_DOWNLOAD_ENCOURS
        const now = new Date().getTime()
        if(now - frequenceUpdate > dernierUpdate) {
            dernierUpdate = now
            const paramsOpts = {etat, [champ]: tailleCompletee, dechiffre: true}
            if(tailleTotale) paramsOpts.tailleContenu = tailleTotale
            marquerDownloadEtat(workers, dispatch, fuuidZip, paramsOpts)
                .catch(err=>console.warn("progressCb Erreur maj download ", err))
        }
    })
    
    await transfertDownloadFichiers.genererFichierZip(workers, downloadInfo, getAborted, progressCb)    
    
    // console.debug("Marquer download %s comme pret / complete", fuuidZip)
    await marquerDownloadEtat(workers, dispatch, fuuidZip, {etat: ETAT_COMPLETE, userId})

    // Retirer downloads fichiers dans zip
    for await(const fuuid of fuuids) {
        await dispatch(arreterDownload(workers, fuuid))    
    }

    await dispatch(completerDownload(workers, fuuidZip))
        .catch(err=>console.error("Erreur cleanup download fichier zip ", err))
}

async function downloadFichier(workers, dispatch, fichier, getAborted) {
    // console.debug("downloadFichier Download fichier params : ", fichier)
    const { transfertDownloadFichiers, clesDao } = workers
    const fuuid = fichier.fuuid,
          dechiffrage = fichier.dechiffrage
        //   fuuidCle = fichier.fuuidCle || fichier.fuuid,
        //   infoDechiffrage = fichier.infoDechiffrage || {},

    // const cles = await clesDao.getCles([fuuidCle])  // Fetch pour cache (ne pas stocker dans redux)
    const cles = await clesDao.getCles([dechiffrage.cle_id])
    // console.debug("downloadFichier Cles a utiliser pour download fichier : ", cles)
    const valueCles = Object.values(cles).pop()
    // Object.assign(valueCles, infoDechiffrage) // Injecter header custom
    Object.assign(valueCles, dechiffrage) // Injecter header custom
    delete valueCles.date
    // Ajuster nonce a multibase
    valueCles.nonce = 'm' + valueCles.nonce

    const frequenceUpdate = 500
    let dernierUpdate = 0
    const progressCb = proxy( (tailleCompletee, opts) => {
        opts = opts || {}
        const champ = opts.champ || 'tailleCompletee'  // tailleCompletee et tailleDechiffree
        const rate = opts.rate
        if(opts.transfertComplete) {
            dernierUpdate = 0  // S'assurer de faire une mise a jour
        }
        let etat = ETAT_DOWNLOAD_ENCOURS
        if(champ === 'tailleDechiffree') etat = CONST_TRANSFERT.ETAT_DOWNLOAD_SUCCES_CHIFFRE
        const now = new Date().getTime()
        if(now - frequenceUpdate > dernierUpdate) {
            dernierUpdate = now
            marquerDownloadEtat(workers, dispatch, fuuid, {etat, [champ]: tailleCompletee, /*dechiffre,*/ rate})
                .catch(err=>console.warn("progressCb Erreur maj download ", err))
        }
    })

    // Downloader les chunks du fichier - supporte resume
    const url = fichier.url
    const dechiffre = fichier.dechiffre || false
    const paramsDownload = {url,fuuid,dechiffre}
    console.debug("downloadFichier Params download ", paramsDownload)
    await transfertDownloadFichiers.downloadFichierParts(workers, paramsDownload, progressCb, getAborted)
    // console.debug("downloadFichier Download fichier complete ", url)
    await marquerDownloadEtat(workers, dispatch, fuuid, {etat: ETAT_DOWNLOAD_SUCCES_CHIFFRE, /*dechiffre: false, */ DEBUG: false})
        .catch(err=>console.warn("progressCb Erreur maj download ", err))

    if(!dechiffre) {
        // Dechiffrer le fichier
        const paramsDechiffrage = {
            fuuid, filename: fichier.nom, mimetype: fichier.mimetype,
            ...valueCles,  // Inclure params optionnels comme iv, header, etc
            password: valueCles.cleSecrete,
        }
        // console.debug("Params dechiffrage : ", paramsDechiffrage)
        await transfertDownloadFichiers.dechiffrerPartsDownload(workers, paramsDechiffrage, progressCb)
    } else {
        // console.debug("downloadFichier Fichier %s deja dechiffre", fuuid)
    }
    await marquerDownloadEtat(workers, dispatch, fuuid, {etat: ETAT_DOWNLOAD_SUCCES_DECHIFFRE, dechiffre: false, DEBUG: false})
        .catch(err=>console.warn("progressCb Erreur maj download ", err))

    if(getAborted && await getAborted()) {
        console.warn("Download cancelled")
        return
    }

    // Download complete, dispatch nouvel etat
    await marquerDownloadEtat(workers, dispatch, fuuid, {etat: ETAT_COMPLETE})
    await dispatch(completerDownload(workers, fuuid))
        .catch(err=>console.error("Erreur cleanup fichier upload ", err))
}

async function marquerDownloadEtat(workers, dispatch, fuuid, etat) {
    const contenu = {fuuid, ...etat}
    const { downloadFichiersDao } = workers
    await downloadFichiersDao.updateFichierDownload(contenu)
    return dispatch(updateDownload(contenu))
}

function getProchainDownload(liste) {
    // console.debug("getProchainDownload Get prochain download pre-tri ", liste)
    const ETATS_RESUME = [
        CONST_TRANSFERT.ETAT_PRET,
    ]
    const listeCopie = liste.filter(item=>ETATS_RESUME.includes(item.etat))
    listeCopie.sort(trierListeDownload)
    // console.debug("Get prochain download liste filtree triee: ", listeCopie)
    return listeCopie.shift()
}

function sortDateCreation(a, b) {
    if(a === b) return 0
    if(!a) return 1
    if(!b) return -1

    const dcA = a.dateCreation,
          dcB = b.dateCreation
    
    if(dcA === dcB) return 0
    if(!dcA) return 1
    if(!dcB) return -1

    return dcA - dcB
}

function calculerPourcentage(liste, completesCycle) {
    let tailleTotale = 0, 
        tailleCompleteeTotale = 0

    const inclureEtats = [ETAT_PRET, ETAT_ECHEC, ETAT_DOWNLOAD_ENCOURS, ETAT_DOWNLOAD_SUCCES_CHIFFRE, ETAT_DOWNLOAD_SUCCES_DECHIFFRE]
    liste.forEach( download => {
        const { fuuid, etat, tailleCompletee, taille } = download

        let inclure = false
        if(inclureEtats.includes(etat)) inclure = true
        else if(ETAT_COMPLETE === etat && completesCycle.includes(fuuid)) inclure = true

        if(inclure) {
            if(tailleCompletee) tailleCompleteeTotale += tailleCompletee
            if(taille) tailleTotale += taille
        }
    })

    const pourcentage = Math.floor(100 * tailleCompleteeTotale / tailleTotale)

    return {total: tailleTotale, complete: tailleCompleteeTotale, pourcentage}
}

export function trierListeDownload(a, b) {
    if(a === b) return 0
    if(!a) return 1
    if(!b) return -1

    // // Trier par taille completee (desc)
    // const tailleCompleteeA = a.tailleCompletee,
    //       tailleCompleteeB = b.tailleCompletee
    // if(tailleCompleteeA !== tailleCompleteeB) {
    //     if(!tailleCompleteeA) return 1
    //     if(!tailleCompleteeB) return -1
    //     return tailleCompleteeB - tailleCompleteeA
    // }

    // Trier par date de creation
    const dateCreationA = a.dateCreation,
          dateCreationB = b.dateCreation
    // if(dateCreationA === dateCreationB) return 0
    if(dateCreationA !== dateCreationB) return dateCreationA - dateCreationB
    if(!dateCreationA) return 1
    if(!dateCreationB) return -1

    const cA = a.correlation,
          cB = b.correlation
    return cA.localeCompare(cB)
}
