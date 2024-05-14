async function dechiffrageMiddlewareListener(workers, actions, thunks, nomSlice, _action, listenerApi) {
    console.debug("dechiffrageMiddlewareListener running effect, action : %O", _action)
    await listenerApi.unsubscribe()

    const batchSize = 100

    try {
        await recupererCles(workers, listenerApi, {batchSize})
        await dechiffrerMessages(workers, actions, listenerApi)
    } catch(err) {
        console.error("dechiffrageMiddlewareListener Erreur chargement ", err)
    } finally {
        await listenerApi.subscribe()
    }
}

export default dechiffrageMiddlewareListener

async function recupererCles(workers, listenerApi, opts) {
    opts = opts || {}
    const batchSize = opts.batchSize || 100

    // Recuperer les cles a dechiffrer
    let cles = getClesMessagesChiffres(listenerApi.getState().messages)
    // console.debug("Cles a recuperer ", cles)
    
    // Fonctionner par batch
    while(cles.length > 0) {
        const batchCles = cles.slice(0, batchSize)
        cles = cles.slice(batchSize)

        const _clesDechiffrees = await workers.clesDao.getCles(batchCles)
        // console.debug("Cles message dechiffres ", _clesDechiffrees)
    }

}

/** @returns CleIds de tous les messages chiffres */
function getClesMessagesChiffres(state) {
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

async function dechiffrerMessages(workers, actions, listenerApi) {

    // Recuperer messages a dechiffrer, vider liste.
    const messagesChiffres = listenerApi.getState().messages.listeDechiffrage
    listenerApi.dispatch(actions.clearDechiffrage())
    
    for(const infoMessage of messagesChiffres) {
        const messageUpdate = await dechiffrerMessage(workers, infoMessage)
        listenerApi.dispatch(actions.mergeMessage(messageUpdate))
    }

}

async function dechiffrerMessage(workers, infoMessage) {
    const messageId = infoMessage.message_id

    // console.debug("Dechiffrer message %O", infoMessage)
    const cleDechiffrageListe = await workers.clesDao.getCles(infoMessage.cle_id)
    const cleDechiffrage = Object.values(cleDechiffrageListe).pop()

    // console.debug("Cle message %O", cleDechiffrage)
    const message = await workers.messagesDao.getMessage(infoMessage.message_id)

    // console.debug("Cle message : %O, message : %O", cleDechiffrage, message)
    const dataChiffre = message.message
    const messageDechiffre = await workers.chiffrage.chiffrage.dechiffrerChampsV2(
        dataChiffre, cleDechiffrage.cleSecrete, {gzip: false})

    // console.debug("Message dechiffre : ", messageDechiffre)
    const messageUpdate = await workers.messagesDao.updateMessage({message_id: messageId, message: messageDechiffre, dechiffre: true})

    return messageUpdate
}
