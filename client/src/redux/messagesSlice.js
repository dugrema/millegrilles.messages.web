import { createSlice, createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import dechiffrageMiddlewareListener from './dechiffrageMiddleware'
import downloadMessagesMiddlewareListener from './downloadMessagesMiddleware'
import creerThunks from './messagesThunks'

const SLICE_NAME = 'messages'

/**
 * 
 * listeMessages : {message_id, date_post, date_traitement, lu, reply_to, sujet}
 * listeDechiffrage: {message_id, cle_id}
 * listeDirty: message_id (str)
 * 
 */
const initialState = {
    listeMessages: null,                // Liste triee de messages
    listeDechiffrage: [],               // Liste de messages a dechiffrer
    listeDirty: [],                     // Liste de messages a downloader (dirty)
    syncTime: null,

    bucket: 'reception',                // Bucket (view)

    sortKeys: {key: 'dateReception', ordre: 1},   // Ordre de tri
    mergeVersion: 0,                    // Utilise pour flagger les changements

    userId: '',                         // UserId courant, permet de stocker plusieurs users localement
}

// Actions

function setUserIdAction(state, action) {
    state.userId = action.payload
    state.bucket = 'reception'

    // Clear
    clearAction(state)
}

function setSortKeysAction(state, action) {
    const sortKeys = action.payload
    state.sortKeys = sortKeys
    if(state.liste) state.liste.sort(genererTriListe(sortKeys))
}

function pushAction(state, action) {
    const mergeVersion = state.mergeVersion
    state.mergeVersion++

    let {liste: payload, clear} = action.payload

    if(clear === true) {
        // Reset listes
        clearAction(state)
    }

    let liste = state.listeMessages || []
    if( Array.isArray(payload) ) {
        const ajouts = payload.map(item=>{return {...item, '_mergeVersion': mergeVersion}})
        liste = liste.concat(ajouts)
    } else {
        const ajout = {...payload, '_mergeVersion': mergeVersion}
        liste.push(ajout)
    }

    // Trier
    liste.sort(genererTriListe(state.sortKeys))
    console.debug("pushAction liste triee : %O", liste)

    state.listeMessages = liste
}

function pushDechiffrageAction(state, action) {
    let {liste: payload, clear} = action.payload

    if(clear === true) state.listeDechiffrage = []  // Reset liste

    let liste = state.listeDechiffrage || []
    if( Array.isArray(payload) ) {
        liste = liste.concat(payload)
    } else {
        liste.push(payload)
    }

    state.listeDechiffrage = liste
}

function pushDirtyAction(state, action) {
    let {liste: payload, syncTime, clear} = action.payload

    if(clear === true) state.listeDirty = []  // Reset liste

    let liste = state.listeDirty || []
    if( Array.isArray(payload) ) {
        liste = liste.concat(payload)
    } else {
        liste.push(payload)
    }

    state.listeDirty = liste
    state.syncTime = syncTime
}

function setDirtyAction(state, action) {
    state.listeDirty = action.payload || []
}

/** @returns CleIds de tous les messages chiffres */
function getClesMessagesChiffresAction(state) {
    const clesSet = new Set()
    // Dedupe les cles
    for(const message of state.listeDechiffrage) {
        clesSet.add(message.cle_id)
    }
    // Convertir set en liste
    const cles = []
    for(const cle of clesSet) {
        cles.push(cle)
    }
    return cles
}

/** @returns Message chiffre ou null si aucun message */
function getProchainMessageChiffreAction(state) {
    return state.listeDechiffrage.unshift()
}

function clearAction(state) {
    state.listeMessages = null
    state.listeDechiffrage = []
    state.listeDirty = []
    state.syncTime = null
}

function changerBucketAction(state, action) {
    state.bucket = action.payload
    // Clear
    clearAction(state)
}

// payload {message_id, ...data}
function mergeMessageAction(state, action) {
    const mergeVersion = state.mergeVersion
    state.mergeVersion++

    let payload = action.payload
    if(!Array.isArray(payload)) {
        payload = [payload]
    }

    for (const payloadAppareil of payload) {
        // console.debug("mergeAppareilAction action: %O", action)
        let { message_id } = payloadAppareil

        // Ajout flag _mergeVersion pour rafraichissement ecran
        const data = {...(payloadAppareil || {})}
        data['_mergeVersion'] = mergeVersion

        const liste = state.listeMessages || []
        
        let peutAppend = false
        if(data.supprime === true) {
            // false
        } else {
            peutAppend = true
        }

        // Trouver un fichier correspondant
        let dataCourant = liste.filter(item=>item.message_id === message_id).pop()

        // Copier donnees vers state
        if(dataCourant) {
            if(data) {
                const copie = {...data}
                Object.assign(dataCourant, copie)
            }

            let retirer = false
            if(dataCourant.supprime === true) {
                // Le document est supprime
                retirer = true
            }

            if(retirer) state.liste = liste.filter(item=>item.message_id !== message_id)

        } else if(peutAppend === true) {
            liste.push(data)
            state.liste = liste
        }
    }

    // Trier
    state.listeMessages.sort(genererTriListe(state.sortKeys))
}

const messagesSlice = createSlice({
    name: SLICE_NAME,
    initialState,
    reducers: {
        setUserId: setUserIdAction,
        changerBucket: changerBucketAction,
        push: pushAction, 
        mergeMessage: mergeMessageAction,
        clear: clearAction,
        setSortKeys: setSortKeysAction,
        pushDirty: pushDirtyAction,
        pushDechiffrage: pushDechiffrageAction,
        getClesMessagesChiffres: getClesMessagesChiffresAction,
        getProchainMessageChiffre: getProchainMessageChiffreAction,
        setDirty: setDirtyAction,
    }
})

export const { 
    setUserId, changerBucket, push, mergeMessage, clear, setSortKeys,
    pushDechiffrage, getClesMessagesChiffres, getProchainMessageChiffre,
    pushDirty, setDirty,
} = messagesSlice.actions

export default messagesSlice.reducer

function creerMiddleware(workers, actions, thunks, nomSlice) {
    // Setup du middleware
    const downloadMessagesMiddleware = createListenerMiddleware()
    downloadMessagesMiddleware.startListening({
        matcher: isAnyOf(actions.pushDirty),
        effect: (action, listenerApi) => downloadMessagesMiddlewareListener(workers, actions, thunks, nomSlice, action, listenerApi)
    }) 

    const dechiffrageMiddleware = createListenerMiddleware()
    dechiffrageMiddleware.startListening({
        matcher: isAnyOf(actions.pushDechiffrage),
        effect: (action, listenerApi) => dechiffrageMiddlewareListener(workers, actions, thunks, nomSlice, action, listenerApi)
    }) 
    
    return { downloadMessagesMiddleware, dechiffrageMiddleware }
}

export const thunks = creerThunks(messagesSlice.actions, SLICE_NAME)

export function setup(workers) {
    return creerMiddleware(workers, messagesSlice.actions, thunks, SLICE_NAME)
}

function genererTriListe(sortKeys) {
    
    const key = sortKeys.key || 'nom',
          ordre = sortKeys.ordre || 1

    return (a, b) => {
        if(a === b) return 0
        if(!a) return 1
        if(!b) return -1

        let valA = a[key], valB = b[key]
        if(key === 'dateReception') {
            valA = a.date_post || a.date_traitement
            valB = b.date_post || b.date_traitement
        }

        if(valA === valB) return 0
        if(!valA) return 1
        if(!valB) return -1

        if(typeof(valA) === 'string') {
            const diff = valA.localeCompare(valB)
            if(diff) return diff * ordre
        } else if(typeof(valA) === 'number') {
            const diff = valA - valB
            if(diff) return diff * ordre
        } else {
            throw new Error(`genererTriListe values ne peut pas etre compare ${''+valA} ? ${''+valB}`)
        }

        // Fallback, nom/tuuid du fichier
        const { tuuid: tuuidA, nom: nomA } = a,
              { tuuid: tuuidB, nom: nomB } = b

        const labelA = nomA || tuuidA,
              labelB = nomB || tuuidB
        
        const compLabel = labelA.localeCompare(labelB)
        if(compLabel) return compLabel * ordre

        // Fallback, tuuid (doit toujours etre different)
        return tuuidA.localeCompare(tuuidB) * ordre
    }
}
