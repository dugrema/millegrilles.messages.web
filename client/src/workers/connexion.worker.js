import { expose } from 'comlink'
// import * as ConnexionClient from '@dugrema/millegrilles.reactjs/src/connexionClient'
import connexionClient from '@dugrema/millegrilles.reactjs/src/connexionClientV2'
import { MESSAGE_KINDS } from '@dugrema/millegrilles.utiljs/src/constantes'

const CONST_DOMAINE_SENSEURSPASSIFS = 'SenseursPassifs',
      CONST_SENSEURSPASSIFS_RELAI = 'senseurspassifs_relai'

function getListeNoeuds() {
  return connexionClient.emitWithAck('getListeNoeuds', {}, {
    kind: MESSAGE_KINDS.KIND_REQUETE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, action: 'listeNoeuds', ajouterCertificat: true})
}

function getListeSenseursNoeud(instance_id, opts) {
  opts = opts || {}
  const partition = opts.partition || instance_id
  console.debug("getListeSenseursNoeud, instance_id: %s", instance_id)
  return connexionClient.emitWithAck(
    'getListeSenseursNoeud', 
    {instance_id}, 
    {
      kind: MESSAGE_KINDS.KIND_REQUETE, 
      domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
      action: 'listeSenseursPourNoeud', 
      ajouterCertificat: true,
      partition,
    }
  )
}

function getAppareilsUsager(requete) {
  requete = requete || {}
  return connexionClient.emitWithAck(
    'getAppareilsUsager',
    requete,
    {
      kind: MESSAGE_KINDS.KIND_REQUETE, 
      domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
      action: 'getAppareilsUsager', 
      ajouterCertificat: true,
    }
  )
}

function getStatistiquesSenseur(requete) {
  return connexionClient.emitWithAck(
    'getStatistiquesSenseur',
    requete,
    {
      kind: MESSAGE_KINDS.KIND_REQUETE, 
      domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
      action: 'getStatistiquesSenseur', 
      ajouterCertificat: true,
    }
  )
}

function majAppareil(params) {
  return connexionClient.emitWithAck(
    'majAppareil', 
    params, 
    {
      kind: MESSAGE_KINDS.KIND_COMMANDE, 
      domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
      action: 'majAppareil', 
      ajouterCertificat: true,
    }
  )
}

function majNoeud(partition, params) {
  return connexionClient.emitWithAck(
    'majNoeud', 
    params, 
    {
      kind: MESSAGE_KINDS.KIND_COMMANDE, 
      domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
      action: 'majNoeud', 
      ajouterCertificat: true,
      partition,
    }
  )
}

function majSenseur(partition, params) {
  return connexionClient.emitWithAck(
    'majSenseur', 
    params, 
    {
      kind: MESSAGE_KINDS.KIND_COMMANDE, 
      domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
      action: 'majSenseur', 
      ajouterCertificat: true,
      partition,
    }
  )
}

function sauvegarderProgramme(params) {
  return connexionClient.emitWithAck(
    'sauvegarderProgramme', 
    params, 
    {
      kind: MESSAGE_KINDS.KIND_COMMANDE, 
      domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
      action: 'sauvegarderProgramme', 
      ajouterCertificat: true,
    }
  )
}

function challengeAppareil(commande) {
  return connexionClient.emitWithAck('challengeAppareil', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
    action: 'challengeAppareil', 
    ajouterCertificat: true,
  })
}

function signerAppareil(commande) {
  return connexionClient.emitWithAck('signerAppareil', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
    action: 'signerAppareil', 
    ajouterCertificat: true,
  })
}

function getAppareilsEnAttente(commande) {
  commande = commande || {}
  return connexionClient.emitWithAck('getAppareilsEnAttente', commande, {
    kind: MESSAGE_KINDS.KIND_REQUETE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
    action: 'getAppareilsEnAttente', 
    ajouterCertificat: true,
  })
}

function commandeAppareil(instance_id, commande) {
  commande = commande || {}
  return connexionClient.emit('commandeAppareil', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_SENSEURSPASSIFS_RELAI, 
    partition: instance_id,
    action: 'commandeAppareil', 
    ajouterCertificat: true,
  })
}

function supprimerAppareil(uuid_appareil) {
  const commande = { uuid_appareil }
  return connexionClient.emitWithAck('supprimerAppareil', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
    action: 'supprimerAppareil', 
    ajouterCertificat: true,
  })
}

function restaurerAppareil(uuid_appareil) {
  const commande = { uuid_appareil }
  return connexionClient.emitWithAck('restaurerAppareil', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
    action: 'restaurerAppareil', 
    ajouterCertificat: true,
  })
}

function getConfigurationUsager(nomUsager) {
  const requete = {nom_usager: nomUsager}
  return connexionClient.emitWithAck('getConfigurationUsager', requete, {
    kind: MESSAGE_KINDS.KIND_REQUETE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
    action: 'getConfigurationUsager',
    ajouterCertificat: true,
  })
}

function majConfigurationUsager(nomUsager, params) {
  const commande = {nom_usager: nomUsager}
  commande.timezone = params.timezone
  return connexionClient.emitWithAck('majConfigurationUsager', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
    action: 'majConfigurationUsager', 
    ajouterCertificat: true,
  })
}

function resetCertificatsAppareils() {
  const commande = {}
  return connexionClient.emitWithAck('resetCertificatsAppareils', commande, {
    kind: MESSAGE_KINDS.KIND_COMMANDE, 
    domaine: CONST_DOMAINE_SENSEURSPASSIFS, 
    action: 'resetCertificatsAppareils', 
    ajouterCertificat: true,
  })
}

// Evenements

async function ecouterEvenementsAppareilsUsager(cb) {
  return connexionClient.subscribe('ecouterEvenementsAppareilsUsager', cb, {}) 
}

async function retirerEvenementsAppareilsUsager(cb) {
  return connexionClient.unsubscribe('retirerEvenementsAppareilsUsager', cb, {}) 
}

// Exposer methodes du Worker
expose({
    // ...ConnexionClient, 
    ...connexionClient,

    // Requetes et commandes privees
    getAppareilsUsager, 
    majAppareil, sauvegarderProgramme,
    challengeAppareil, signerAppareil, getAppareilsEnAttente,
    
    getConfigurationUsager, majConfigurationUsager,
    getListeSenseursNoeud, getStatistiquesSenseur,
    getListeNoeuds, majNoeud, 
    majSenseur, commandeAppareil,
    supprimerAppareil, restaurerAppareil, resetCertificatsAppareils,

    // Event listeners proteges
    ecouterEvenementsAppareilsUsager, retirerEvenementsAppareilsUsager,

})
