async function dechiffrageMiddlewareListener(workers, actions, thunks, nomSlice, _action, listenerApi) {
    // console.debug("dechiffrageMiddlewareListener running effect, action : %O", _action)
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
    
    // Fonctionner par batch, pre-charger les cles dans IDB (local)
    while(cles.length > 0) {
        const batchCles = cles.slice(0, batchSize)
        cles = cles.slice(batchSize)

        await workers.clesDao.getCles(batchCles)
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
    // Charger la liste (getState) a chaque message. Permet de dechiffrer de nouveau messages recus 
    // durant le processus ou d'arreter le dechiffrage au changement de bucket.
    while(listenerApi.getState().messages.listeDechiffrage.length > 0) {
        let messagesChiffres = listenerApi.getState().messages.listeDechiffrage
        const infoMessage = messagesChiffres[0]
        messagesChiffres = messagesChiffres.slice(1)  // Retirer premier message
        listenerApi.dispatch(actions.setDechiffrage(messagesChiffres))
        
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
    console.debug("Message dechiffre : ", messageDechiffre)

    // Tenter de generer un sujet
    const {sujet} = extraireSujet(messageDechiffre.contenu)
    if(sujet) {
        console.debug("Sujet : ", sujet)
        messageDechiffre.sujet = sujet
    }

    const nouveauContenu = {message_id: messageId, message: messageDechiffre, dechiffre: true}
    const messageUpdate = await workers.messagesDao.updateMessage(nouveauContenu)

    return messageUpdate
}

const REGEX_SUBJECT = /^<p>([^<]+)<\/p><p><br><\/p>(.*)/i

function extraireSujet(contenu) {
    // Extraire premiere ligne pour faire le sujet
    let sujet = ''
    try {
        const matchSubject = REGEX_SUBJECT.exec(contenu)
        console.debug("Match sujet %O, contenu:\n%s", matchSubject, contenu)
        if(matchSubject && matchSubject.length === 3) {
            sujet = matchSubject[1]
            contenu = matchSubject[2]
        }
        
    } catch(err) {
        console.error("Erreur preparation sujet : %O", err)
    }
    return {sujet, contenu}
}