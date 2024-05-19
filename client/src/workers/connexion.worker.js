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

function marquerLu(messageIds) {
  let message_ids = messageIds
  if(typeof(message_ids) === 'string') message_ids = [message_ids]
  const commande = {message_ids}
  return connexionClient.emitWithAck('marquerLu', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_DOMAINE_MESSAGES, action: 'marquerLu', ajouterCertificat: true})
}

function supprimerMessage(messageIds) {
  let message_ids = messageIds
  if(typeof(message_ids) === 'string') message_ids = [message_ids]
  const commande = {message_ids}
  return connexionClient.emitWithAck('supprimerMessage', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_DOMAINE_MESSAGES, action: 'supprimerMessage', ajouterCertificat: true})
}

// Evenements

async function ecouterEvenementsMessagesUsager(cb) {
  return connexionClient.subscribe('ecouterEvenementsMessagesUsager', cb, {}) 
}

async function retirerEvenementsMessagesUsager(cb) {
  return connexionClient.unsubscribe('retirerEvenementsMessagesUsager', cb, {}) 
}

// Exposer methodes du Worker
expose({
    // ...ConnexionClient, 
    ...connexionClient,

    // Requetes et commandes privees
    syncMessages, getMessagesParIds, dechiffrerCles, marquerLu, supprimerMessage,

    // Event listeners proteges
    ecouterEvenementsMessagesUsager, retirerEvenementsMessagesUsager,

})
