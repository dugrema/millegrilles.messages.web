import ouvrirDB, {STORE_MESSAGES_USAGERS} from './idbMessages'

export function init() {
    return ouvrirDB()
}

// Met dirty a true et dechiffre a false si mismatch derniere_modification
export async function syncMessages(userId, bucket, docs, opts) {
    opts = opts || {}
    if(!userId) throw new Error("userId requis")
    if(!bucket) throw new Error("bucket requis")
    if(!docs) return []
    const syncTime = opts.syncTime

    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readwrite').store

    let messagesDirty = []
    for await (const message of docs) {
        const { message_id, derniere_modification } = message
        const messageDoc = await store.get(message_id)
        if(messageDoc) {
            messageDoc.syncTime = syncTime
            if(messageDoc.supprime !== message.supprime) {
                // Mettre a jour flag supprime
                messageDoc.supprime = !!message.supprime
            }
            if(derniere_modification !== messageDoc.derniere_modification) {
                // Fichier connu avec une date differente
                messagesDirty.push(message_id)
                if(messageDoc.dirty !== false) {
                    // Conserver flag dirty
                    messageDoc.dirty = true
                }
            } else if(messageDoc.dirty) {
                // Flag existant
                messagesDirty.push(message_id)
            }

            // Conserver mises a jour, incluant syncTime
            await store.put(messageDoc)

        } else {
            // Message inconnu
            await store.put({...message, syncTime, user_id: userId, bucket, dirty: true, dechiffre: false})
            messagesDirty.push(message_id)
        }
    }

    return messagesDirty
}

// opts {merge: true, dechiffre: true}, met dirty a false
export async function updateMessage(doc, opts) {
    opts = opts || {}

    const { message_id } = doc
    if(!message_id) throw new Error('updateDocument message_id doit etre fourni')

    const flags = ['dirty', 'dechiffre']
          
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readwrite').store
    const messageDoc = (await store.get(message_id)) || {}
    Object.assign(messageDoc, doc)

    // Changer flags
    flags.forEach(flag=>{
        const val = opts[flag]
        if(val !== undefined) messageDoc[flag] = !!val
    })

    await store.put(messageDoc)

    return mapperMessageRow(messageDoc)
}

export async function deleteDocuments(tuuids) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readwrite').store
    for await (const tuuid of tuuids) {
        await store.delete(tuuid)
    }
}

/** Recupere les messages avec flag dirty ou dechiffre a true */
export async function getIncomplets(userId, bucket) {
    const db = await ouvrirDB()

    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readonly').store
    const index = store.index('userBucket')
    let curseur = await index.openCursor([userId, bucket])

    const messagesComplets = [], messagesDirty = [], messagesChiffres = []
    while(curseur) {
        const {message_id, dirty, dechiffre, message} = curseur.value
        if(!dechiffre && !dirty) {
            messagesChiffres.push({message_id, cle_id: message.cle_id})
        } else if(dirty) {
            messagesDirty.push(message_id)
        } else if(dechiffre && !dirty) {
            messagesComplets.push(mapperMessageRow(curseur.value))
        }
        curseur = await curseur.continue()
    }

    return {complets: messagesComplets, dirty: messagesDirty, chiffres: messagesChiffres}
}

export async function getMessage(messageId) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readonly').store
    return store.get(messageId)
}

export async function getMessagesParBucket(userId, bucket) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readonly').store
    const index = store.index('userBucket')
    let curseur = await index.openCursor([userId, bucket])
    const messages = []
    while(curseur) {
        // Mapper message pour affichage
        const messageMappe = mapperMessageRow(curseur.value)
        messages.push(messageMappe)
        curseur = await curseur.continue()
    }
    return messages
}

function mapperMessageRow(messageRow) {
    const message = messageRow.message

    const messageMappe = {
        message_id: messageRow.message_id,
        lu: !!messageRow.lu,
        supprime: !!messageRow.supprime,
        date_post: message.date_post,
        date_traitement: messageRow.date_traitement,
        derniere_modification: messageRow.derniere_modification,
    }

    return messageMappe
}

// cuuid falsy donne favoris
export async function getParCollection(cuuid, userId) {
    const db = await ouvrirDB()

    let collection = null
    if(cuuid) {
        const store = db.transaction(STORE_MESSAGES_USAGERS, 'readonly').store
        collection = await store.get(cuuid)
    }

    // Curseur fichiers (cuuids)
    let curseur = null
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readonly').store        
    //curseur = await store.openCursor()
    if(cuuid) {
        const index = store.index('cuuid')
        // const index = store.index('pathCuuids')
        curseur = await index.openCursor(cuuid)
    } else {
        // Favoris
        // const index = store.index('userFavoris')
        const index = store.index('userTypeNode')
        curseur = await index.openCursor([userId, 'Collection'])
    }

    // Curseur fichiers et sous-repertoires (cuuid)
    const docs = []
    // let compteur = 0, compteurSupprimes = 0
    while(curseur) {
        // compteur++
        const value = curseur.value
        // console.debug("getParCollection Row %O = %O", curseur, value)
        const { path_cuuids, type_node, user_id, supprime } = value
        if(supprime === true) {
            // Supprime
            // compteurSupprimes++
        } else if(!cuuid) {
            // Favoris
            if(user_id === userId && type_node === 'Collection') docs.push(value)
        // } else if(cuuids && cuuids.includes(cuuid)) {
        } else if(path_cuuids && path_cuuids[0] === cuuid) {
            docs.push(value)
        }
        curseur = await curseur.continue()
    }

    return { collection, documents: docs }
}

export async function getPlusrecent(intervalle, userId) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readonly').store

    const { debut, fin } = intervalle
    if(!debut) throw new Error("Date debut est requise dans l'intervalle")
    // console.debug("Date debut : %O", new Date(debut*1000))
    // if(fin) console.debug("Date fin : %O", new Date(fin*1000))

    let curseur = await store.openCursor()
    const docs = []
    while(curseur) {
        const value = curseur.value
        const { tuuid, cuuids, favoris, user_id, supprime } = value
        // console.debug("Message %O = %O", key, value)
        let conserver = false

        if(user_id !== userId) {
            // User different, ignorer
        } else if(supprime === true) {
            // Supprime, ignorer
        } else {
            const champsDate = ['derniere_modification', 'date_creation']
            champsDate.forEach(champ=>{
                const valDate = value[champ]
                if(valDate) {
                    // console.debug("Date %s: %s = %O", value.tuuid, champ, new Date(valDate*1000))
                    if(valDate >= debut) {
                        if(fin) {
                            if(valDate <= fin) conserver = true
                        } else {
                            // Pas de date de fin
                            conserver = true
                        }
                    }
                }
            })
        }
        
        if(conserver) docs.push(value)
        
        curseur = await curseur.continue()
    }

    // console.debug('getPlusrecent intervalle %O userId: %s resultat documents %O', intervalle, userId, docs)

    return docs
}

export async function getSupprime(intervalle, userId) {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readonly').store

    let curseur = await store.openCursor()
    const docs = []
    while(curseur) {
        const value = curseur.value
        // console.debug("Message %O = %O", key, value)
        const { user_id, supprime, supprime_indirect } = value
        let conserver = false
        // const supprimeEffectif = !!(supprime || supprime_indirect)
        const supprimeEffectif = (supprime || supprime_indirect)

        if(user_id === userId && supprimeEffectif === true) {
            conserver = true
        }
        
        if(conserver) docs.push(value)
        
        curseur = await curseur.continue()
    }

    // console.debug('getSupprime intervalle %O userId: %s resultat documents %O', intervalle, userId, docs)

    return docs
}

export async function entretien() {
    const db = await ouvrirDB()

    // Retirer les valeurs expirees
    await retirerFichiersExpires(db)
}

// Supprime le contenu de idb
export async function clear() {
    const db = await ouvrirDB()
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readwrite').store
    store.clear()
}

async function retirerFichiersExpires(db) {
    const now = new Date().getTime()
    // console.debug("Expirer documents avant ", new Date(now))
    const store = db.transaction(STORE_MESSAGES_USAGERS, 'readwrite').store
    let curseur = await store.openCursor()
    while(curseur) {
        const { expiration } = curseur.value
        if(expiration < now) {
            // console.debug("Expirer %s : %O", tuuid, new Date(expiration))
            curseur.delete()
        }
        curseur = await curseur.continue()
    }
}
