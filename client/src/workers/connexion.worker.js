import { expose } from 'comlink'
// import * as ConnexionClient from '@dugrema/millegrilles.reactjs/src/connexionClient'
import connexionClient from '@dugrema/millegrilles.reactjs/src/connexionClientV2'
import { MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'

const CONST_DOMAINE_MESSAGES = 'Messages'

function syncMessages(bucket, skip, limit) {
  const requete = {bucket, skip, limit}
  return connexionClient.emitWithAck('syncMessages', requete, {
    kind: MESSAGE_KINDS.KIND_REQUETE, 
    domaine: CONST_DOMAINE_MESSAGES, action: 'syncMessages', ajouterCertificat: true})
}

function getMessagesParIds(messageIds) {
  const requete = {message_ids: messageIds}
  return connexionClient.emitWithAck('getMessagesParIds', requete, {
    kind: MESSAGE_KINDS.KIND_REQUETE, 
    domaine: CONST_DOMAINE_MESSAGES, action: 'getMessagesParIds', ajouterCertificat: true})
}

function dechiffrerCles(cleIds) {
  const requete = {cle_ids: cleIds}
  return connexionClient.emitWithAck('dechiffrerCles', requete, {
    kind: MESSAGE_KINDS.KIND_REQUETE, 
    domaine: CONST_DOMAINE_MESSAGES, action: 'dechiffrerCles', ajouterCertificat: true})
}

// Evenements

// async function ecouterEvenementsAppareilsUsager(cb) {
//   return connexionClient.subscribe('ecouterEvenementsAppareilsUsager', cb, {}) 
// }

// async function retirerEvenementsAppareilsUsager(cb) {
//   return connexionClient.unsubscribe('retirerEvenementsAppareilsUsager', cb, {}) 
// }

// Exposer methodes du Worker
expose({
    // ...ConnexionClient, 
    ...connexionClient,

    // Requetes et commandes privees
    syncMessages, getMessagesParIds, dechiffrerCles,

    // Event listeners proteges
    //ecouterEvenementsAppareilsUsager, retirerEvenementsAppareilsUsager,

})
