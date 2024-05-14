function creerThunks(actions, nomSlice) {

    // Action creators are generated for each case reducer function
    const { 
        push, clear, mergeMessage,
    } = actions

    function syncMessages(workers, opts) {
        return (dispatch, getState) => traiterSyncMessages(workers, opts, dispatch, getState)
    }

    async function traiterSyncMessages(workers, opts, dispatch, getState) {
        console.debug("State : ", getState())
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

    // Async actions
    const thunks = { 
        syncMessages,
    }

    return thunks
}

export default creerThunks
