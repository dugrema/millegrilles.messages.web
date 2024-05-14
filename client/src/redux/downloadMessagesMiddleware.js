async function downloadMessagesMiddlewareListener(workers, actions, thunks, nomSlice, _action, listenerApi) {
    console.debug("downloadMessagesMiddlewareListener running effect, action : %O", _action)
    await listenerApi.unsubscribe()
    try {
        const batchSize = 5
        while(true) {
            // Download messages en batch
            const listeDirty =  listenerApi.getState().messages.listeDirty
            const batchDirty = listeDirty.slice(0, batchSize)
            listenerApi.dispatch(actions.setDirty(listeDirty.slice(batchSize)))
            
            if(batchDirty.length === 0) break
            
            // Downloader messages
            console.debug("downloadMessagesMiddlewareListener Batch : ", batchDirty)
            const reponse = await workers.connexion.getMessagesParIds(batchDirty)
            console.debug("downloadMessagesMiddlewareListener Reponse messages : ", reponse)

            for(const message of reponse.messages) {
                await workers.messagesDao.updateMessage(message, {dirty: false})
            }

            // Declencher dechiffrage des messages recus
            const messagesChiffres = reponse.messages.map(item=>{
                return {message_id: item.message_id, cle_id: item.message.cle_id}
            })
            listenerApi.dispatch(actions.pushDechiffrage({liste: messagesChiffres}))
        }
    } catch(err) {
        console.error("downloadMessagesMiddlewareListener Erreur chargement ", err)
        // listenerApi.dispatch(actions.setEtapeChargement(CONST_ETAPE_CHARGEMENT_ERREUR))
    } finally {
        await listenerApi.subscribe()
    }
}

export default downloadMessagesMiddlewareListener

