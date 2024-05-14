function creerThunks(actions, nomSlice) {

    // Action creators are generated for each case reducer function
    const { 
        push, clear, mergeMessage,
    } = actions

    function syncMessages(workers, opts) {
        return (dispatch, getState) => traiterSyncMessages(workers, opts, dispatch, getState)
    }

    async function traiterSyncMessages(workers, opts, dispatch, getState) {
        const bucket = getState().messages.bucket
        const userId = getState().messages.userId
        let skip = 0
        const limit = 100

        const syncTime = new Date().getTime()

        while(true) {
            const reponse = await workers.connexion.syncMessages(bucket, skip, limit)
            console.debug("Sync messages reponse : ", reponse)

            const messages = reponse.messages || []
            
            // Pagination des batch
            if(messages.length === 0) break
            skip += messages.length

            const dirty = await workers.messagesDao.syncMessages(userId, bucket, messages, {syncTime})
            if(dirty.length > 0) {
                // Declencher dechiffrage
                dispatch(actions.pushDirty({liste: dirty, syncTime}))
            }
        }

        // Todo : Cleanup messages qui n'ont pas ete vus (syncTime vieux)

    }

    /** Change le bucket, redemarre le traitement des fichiers dirty ou chiffre a partir de IDB pour un bucket */
    function changerBucket(workers, bucket, opts) {
        opts = opts || {}
        bucket = bucket || 'reception'
        return (dispatch, getState) => traiterChangerBucket(workers, bucket, opts, dispatch, getState)
    }

    async function traiterChangerBucket(workers, bucket, opts, dispatch, getState) {
        dispatch(actions.setBucket(bucket))
        const userId = getState().messages.userId

        const {complets, dirty, chiffres} = await workers.messagesDao.getIncomplets(userId, bucket)
        console.debug("Messages complets: %O, dirty: %O, chiffres: %O", complets, dirty, chiffres)

        if(complets.length > 0) {
            dispatch(actions.push({clear: true, liste: complets}))
        }

        // Requete fichiers chiffres qui ne sont pas dirty
        if(chiffres.length > 0) {
            dispatch(actions.pushDechiffrage({liste: chiffres}))
        }

        // Requete fichiers dirty
        if(dirty.length > 0) {
            dispatch(actions.pushDirty({liste: dirty}))
        }

        // Synchroniser les messages
        await traiterSyncMessages(workers, opts, dispatch, getState)
    }

    // Async actions
    const thunks = { 
        syncMessages, changerBucket,
    }

    return thunks
}

export default creerThunks
