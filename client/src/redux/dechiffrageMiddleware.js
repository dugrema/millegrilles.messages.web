async function dechiffrageMiddlewareListener(workers, actions, thunks, nomSlice, _action, listenerApi) {
    // console.debug("dechiffrageMiddlewareListener running effect, action : %O, listener : %O", action, listenerApi)
    await listenerApi.unsubscribe()
    try {
        // let etapeChargement = listenerApi.getState()[nomSlice].etapeChargement
        
        // if(etapeChargement === CONST_ETAPE_CHARGEMENT_LISTE) {
        //     // Downloader les fichiers du repertoire courant en utilisant la liste IDB
        //     // console.warn("dechiffrageMiddlewareListener Effectuer chargement de la liste (etape est : %d)", etapeChargement)
        //     const task = listenerApi.fork( forkApi => chargerListe(workers, listenerApi, actions, thunks, nomSlice) )
        //     const taskResult = await task.result
        //     const listeChargee = taskResult.value
            
        //     if(taskResult.status === 'ok') {
        //         // console.debug("dechiffrageMiddlewareListener Liste chargee : ", listeChargee)
        //         // Conserver la liste dans state (one-shot)
        //         listenerApi.dispatch(actions.setFichiersChiffres(listeChargee))
        //         for(const item of listeChargee) {
        //             listenerApi.dispatch(actions.mergeTuuidData({tuuid: item.tuuid, data: item}))
        //         }
        //         // console.debug("dechiffrageMiddlewareListener Liste fichiers state apres chargement liste : ", listenerApi.getState()[nomSlice].liste)

        //         // console.debug("dechiffrageMiddlewareListener Chargement tuuids dirty termine, passer au dechiffrage")
        //         listenerApi.dispatch(actions.setEtapeChargement(CONST_ETAPE_CHARGEMENT_DECHIFFRAGE))
        //     } else {
        //         console.error("dechiffrageMiddlewareListener Erreur traitement chargerListe, resultat ", taskResult)
        //     }

        //     etapeChargement = CONST_ETAPE_CHARGEMENT_DECHIFFRAGE
        // } 
        
        // if(etapeChargement >= CONST_ETAPE_CHARGEMENT_DECHIFFRAGE) {
        //     // console.warn("dechiffrageMiddlewareListener Effectuer dechiffrage (etape est : %d, passe %d)", etapeChargement, passeMiddleware)
        //     const task = listenerApi.fork( forkApi => dechiffrerFichiers(workers, listenerApi, actions, nomSlice) )
        //     const {value: fichiersDechiffres} = await task.result

        //     // HACK - Reinserer les scores de recherche
        //     const resultatRecherche = listenerApi.getState().fichiers.resultatRecherche
        //     // console.debug("dechiffrageMiddlewareListener Resultat recherche : %O", resultatRecherche)
        //     if(resultatRecherche) {
        //         if(fichiersDechiffres) {
        //             for(const item of fichiersDechiffres) {
        //                 const tuuid = item.tuuid
        //                 if(resultatRecherche && resultatRecherche.dictDocs) {
        //                     // Resultat recherche, combiner le score
        //                     const itemRecherche = resultatRecherche.dictDocs[tuuid]
        //                     if(itemRecherche) item.score = itemRecherche.score
        //                 }
        //                 listenerApi.dispatch(actions.mergeTuuidData({tuuid: item.tuuid, data: item}))
        //             }
        //         }
        //         listenerApi.dispatch(actions.setNombreFichiersTotal(resultatRecherche.numFound||0))
        //     }

        //     // console.debug("dechiffrageMiddlewareListener Dechiffrage complete, liste prete")
        //     listenerApi.dispatch(actions.setEtapeChargement(CONST_ETAPE_CHARGEMENT_COMPLETE))
        //     listenerApi.dispatch(actions.setDechiffrageComplete())

        //     // Reload tous les fichiers non dechiffres en memoire
        //     // console.debug("dechiffrageMiddlewareListener Fichiers dechiffres : ", fichiersDechiffres)
        //     listenerApi.dispatch(actions.remplacerFichiers(fichiersDechiffres))
        // }
    } catch(err) {
        console.error("dechiffrageMiddlewareListener Erreur chargement ", err)
        // listenerApi.dispatch(actions.setEtapeChargement(CONST_ETAPE_CHARGEMENT_ERREUR))
    } finally {
        await listenerApi.subscribe()
    }
}

export default dechiffrageMiddlewareListener

