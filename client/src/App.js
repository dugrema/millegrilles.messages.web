import React, {Suspense, useState, useEffect, useMemo, useCallback} from 'react'
import { proxy as comlinkProxy } from 'comlink'
import { useTranslation } from 'react-i18next'

import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux'

import Container from 'react-bootstrap/Container'
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'

import ErrorBoundary from './ErrorBoundary'
import useWorkers, {useEtatConnexion, useEtatConnexionOpts, WorkerProvider, useUsager, useFormatteurPret, useInfoConnexion, useEtatPret, useModalTransfertEnCours} from './WorkerContext'
import storeSetup from './redux/store'

import { setUserId as setUserIdMessages, pushDirty, thunks as thunksMessages } from './redux/messagesSlice'
import { setUserId as setUserIdDownload, supprimerDownloadsParEtat, continuerDownload, arreterDownload, setDownloads } from './redux/downloaderSlice'

import * as CONST_ETAT_TRANSFERT from './transferts/constantes'

import i18n from './i18n'

import { LayoutMillegrilles, ModalErreur, initI18n, OuvertureSessionModal } from '@dugrema/millegrilles.reactjs'

// Importer JS global
import 'react-bootstrap/dist/react-bootstrap.min.js'

// Importer cascade CSS global
import 'bootstrap/dist/css/bootstrap.min.css'
import 'font-awesome/css/font-awesome.min.css'
import "react-datetime/css/react-datetime.css"
import '@dugrema/millegrilles.reactjs/dist/index.css'

import './index.scss'
import './App.css'

import TransfertModal from './TransfertModal'

// Wire i18n dans module @dugrema/millegrilles.reactjs
initI18n(i18n)

const Menu = React.lazy( () => import('./Menu') )
const Accueil = React.lazy( () => import('./Accueil') )
const Reception = React.lazy( () => import('./Reception') )

// const _contexte = {}  // Contexte global pour comlink proxy callbacks

const CONST_DOWNLOAD_COMPLET_EXPIRE = 48 * 60 * 60 * 1000  // Auto-cleanup apres 2 jours (millisecs) du download

function App() {
  
  return (
    <WorkerProvider attente={<Attente />}>
      <ErrorBoundary>
        <Suspense fallback={<Attente />}>
          <ProviderReduxLayer />
        </Suspense>
      </ErrorBoundary>
    </WorkerProvider>
  )

}
export default App

function ProviderReduxLayer() {

  const workers = useWorkers()
  const store = useMemo(()=>{
    if(!workers) return
    return storeSetup(workers)
  }, [workers])

  return (
    <ReduxProvider store={store}>
        <LayoutMain />
    </ReduxProvider>
  )
}

function LayoutMain(props) {

  const { i18n, t } = useTranslation()

  const workers = useWorkers()
  const dispatch = useDispatch()
  const usager = useUsager()
  const etatConnexion = useEtatConnexion()
  const etatConnexionOpts = useEtatConnexionOpts()
  const etatFormatteurMessage = useFormatteurPret()
  const infoConnexion = useInfoConnexion()

  const [sectionAfficher, setSectionAfficher] = useState('')
  const [erreur, setErreur] = useState(false)
  const [showTransfertModal, setShowTransfertModal] = useState(false)

  const erreurCb = useCallback((err, message)=>{
    console.error("Erreur %s : %O", message, err)
    setErreur({err, message})
  }, [setErreur])
  const handlerCloseErreur = useCallback(()=>setErreur(false), [setErreur])
  const showTransfertModalOuvrir = useCallback(()=>{ setShowTransfertModal(true) }, [setShowTransfertModal])
  const showTransfertModalFermer = useCallback(()=>{ setShowTransfertModal(false) }, [setShowTransfertModal])

  const handlerSupprimerDownloads = useCallback( params => supprimerDownloads(workers, dispatch, params, erreurCb), [dispatch, workers, erreurCb])
  const handlerContinuerDownloads = useCallback( params => {
    console.debug("Continuer download ", params)
    let fuuid = params
    if(typeof(params) !== 'string') {
      fuuid = params.fuuid
    }

    workers.downloadFichiersDao.getDownload(fuuid)
      .then(info=>{
        console.debug("Download info a resumer : ", info)
        info.etat = CONST_ETAT_TRANSFERT.ETAT_PRET
        info.complet = false
        dispatch(continuerDownload(info))
      })
      .catch(err=>console.error("Erreur continuer download : ", err))
  }, [workers])

  const etatAuthentifie = usager && etatFormatteurMessage

  const [userId, estProprietaire] = useMemo(()=>{
    if(!usager) return [null, null]
    const extensions = usager.extensions
    return [extensions.userId, extensions.delegationGlobale === 'proprietaire']
  }, [usager])

  const menu = (
    <Menu
        i18n={i18n} 
        estProprietaire={estProprietaire}
        setSectionAfficher={setSectionAfficher} 
        showTransfertModal={showTransfertModalOuvrir} />
  ) 

  return (
      <LayoutMillegrilles menu={menu}>

        <div className='top-spacer-menu'></div>
        
        <Container className="contenu">

            <Suspense fallback={<Attente workers={workers} idinfoConnexionmg={infoConnexion} etatConnexion={etatAuthentifie} />}>
              <ApplicationSenseursPassifs 
                  workers={workers}
                  usager={usager}
                  etatAuthentifie={etatAuthentifie}
                  etatConnexion={etatConnexion}
                  infoConnexion={infoConnexion}
                  sectionAfficher={sectionAfficher}
                  setSectionAfficher={setSectionAfficher}
                />
            </Suspense>

        </Container>

        <InitialisationDownload />

        <Modals 
            showTransfertModal={showTransfertModal}
            showTransfertModalFermer={showTransfertModalFermer}
            erreur={erreur}
            handlerCloseErreur={handlerCloseErreur}
            supprimerDownloads={handlerSupprimerDownloads}
            continuerDownloads={handlerContinuerDownloads}
          />

        <OuvertureSessionModal 
            workers={workers}
            etatConnexion={etatConnexion} 
            etatConnexionOpts={etatConnexionOpts} 
            usager={usager}
          />

        <ReceptionMessageListener userId={userId} />

      </LayoutMillegrilles>
  )  

}

function ApplicationSenseursPassifs(props) {

  const { sectionAfficher, setSectionAfficher} = props

  let Page = null
  switch(sectionAfficher) {
    case 'Reception': Page = Reception; break
    default:
      Page = Accueil
  }

  return (
    <Container className="main-body">
      <Page setSectionAfficher={setSectionAfficher} />
    </Container>
  )

}

function Attente(_props) {
  return (
      <div>
          <p className="titleinit">Preparation de Messages</p>
          <p>Veuillez patienter durant le chargement de la page.</p>
          <ol>
              <li>Initialisation</li>
              <li>Chargement des composants dynamiques</li>
              <li>Connexion a la page</li>
          </ol>
      </div>
  )
}

function ReceptionMessageListener(props) {

  const { userId } = props

  const workers = useWorkers(),
        dispatch = useDispatch(),
        etatPret = useEtatPret()

  // Setup userId dans redux
  useEffect(()=>{
    dispatch(setUserIdMessages(userId))
    dispatch(setUserIdDownload(userId))
  }, [dispatch, userId])
  

  const messageUsagerHandler = useMemo(
    () => comlinkProxy( evenement => traiterMessageEvenement(workers, dispatch, evenement) ),
    [workers, dispatch]
)  

  // Enregistrer listeners d'evenements message
  useEffect(()=>{
    if(!etatPret) return  // Rien a faire

    // Ajouter listeners messages
    workers.connexion.ecouterEvenementsMessagesUsager(messageUsagerHandler)
      .catch(err=>console.error("Erreur ajout listener messages usager : %O", err))

    // Demarrer sync messages
    dispatch(thunksMessages.changerBucket(workers, 'reception'))
      .catch(err=>console.error("ReceptionMessageListener Erreur changerBucket/syncMessages ", err))

    return () => {
      // Retirer listeners messages
      workers.connexion.retirerEvenementsMessagesUsager(messageUsagerHandler)
        .catch(err=>console.info("Erreur retrait listener messages usager : %O", err))
    }
  }, [workers, etatPret, messageUsagerHandler])

  return ''
}

async function traiterMessageEvenement(workers, dispatch, evenement) {
  console.debug("Evenement sur message recu : %O", evenement)
  const action = evenement.routingKey.split(".").pop()
  if(action === 'nouveauMessage') {
    await traiterEvenementNouveauMessage(workers, dispatch, evenement)
  } else if(action === 'messageSupprime') {
    await traiterEvenementMessageSupprime(workers, dispatch, evenement)
  } else if(action === 'messageLu') {
    await traiterEvenementMessageLu(workers, dispatch, evenement)
  } else {
    console.debug("traiterMessageEvenement Evenement non supporte ", evenement)
    throw new Error(`traiterMessageEvenement Action non supportee : ${action}`)
  }
}

async function traiterEvenementNouveauMessage(workers, dispatch, evenement) {
  const message = evenement.message
  console.debug("traiterEvenementNouveauMessage ", evenement)
  const nouveauMessage = {
    message_id: message.message_id,
    user_id: message.user_id,
    derniere_modification: 0,
    supprime: false,
    dirty: true,
    dechiffre: false,
    lu: false,
    bucket: 'reception',
    syncTime: evenement.message['__original'].estampille,
    message: {}
  }
  await workers.messagesDao.updateMessage(nouveauMessage)

  dispatch(pushDirty({liste: [message.message_id]}))
}

async function traiterEvenementMessageSupprime(workers, dispatch, evenement) {
  const message = evenement.message
  console.debug("traiterEvenementMessageSupprime ", evenement)
  const messageIds = message.message_ids
  dispatch(thunksMessages.supprimerMessages(workers, messageIds))
    .catch(err=>console.error("traiterEvenementMessageSupprime Erreur supprimer messages", err))
}

async function traiterEvenementMessageLu(workers, dispatch, evenement) {
  const message = evenement.message
  console.debug("traiterEvenementMessageLu ", evenement)
  const messageIds = message.message_ids
  dispatch(thunksMessages.setMessagesLus(workers, messageIds))
    .catch(err=>console.error("traiterEvenementMessageLu Erreur marquer messages lus", err))
}

function Modals(props) {

  const { 
    showTransfertModal, showTransfertModalFermer, erreur, handlerCloseErreur, 
    supprimerDownloads, continuerDownloads,
  } = props

  const workers = useWorkers()
  const { t } = useTranslation()
  const downloads = useSelector(state=>state.downloader.liste)
  const progresDownload = useSelector(state=>state.downloader.progres)
  const [modalTransfertEnCours, setModalTransfertEnCours] = useModalTransfertEnCours()

  const fermerModalTransfertEnCours = useCallback(()=>setModalTransfertEnCours(false), [setModalTransfertEnCours])

  return (
    <div>
      <TransfertModal 
          workers={workers}
          show={showTransfertModal}
          fermer={showTransfertModalFermer} 
          downloads={downloads}
          progresDownload={progresDownload}
          supprimerDownloads={supprimerDownloads}
          continuerDownloads={continuerDownloads}
        />

      <ModalErreur 
          workers={workers}
          show={!!erreur} 
          err={erreur.err} 
          message={erreur.message} 
          titre={t('Erreur.titre')} 
          fermer={handlerCloseErreur} 
        />

      <ModalTransfertEnCours
        show={!!modalTransfertEnCours}
        fermer={fermerModalTransfertEnCours} />
    </div>
  )
}

function InitialisationDownload(props) {

  const workers = useWorkers()
  const usager = useUsager()
  const dispatch = useDispatch()

  const { downloadFichiersDao } = workers

  const userId = useMemo(()=>{
    if(!usager || !usager.extensions) return
    return usager.extensions.userId
  }, [usager])

  useEffect(()=>{
    dispatch(setUserIdDownload(userId))
  }, [userId])

  useEffect(()=>{
    if(!downloadFichiersDao || !userId) return
    // console.debug("Initialiser uploader")
    downloadFichiersDao.chargerDownloads(userId)
        .then(async downloads=>{
            // console.debug("Download trouves : %O", downloads)

            const completExpire = new Date().getTime() - CONST_DOWNLOAD_COMPLET_EXPIRE

            downloads = downloads.filter(download=>{
                const { fuuid, etat } = download
                if([CONST_ETAT_TRANSFERT.ETAT_COMPLETE].includes(etat)) {
                    // Cleanup
                    if(download.derniereModification <= completExpire) {
                        // Complet et expire, on va retirer l'upload
                        downloadFichiersDao.supprimerFichier(fuuid)
                            .catch(err=>console.error("Erreur supprimer fichier ", err))
                        return false
                    }
                }
                return true
            }).map(item=>{
              // Retirer blob, non serializable
              return {...item, blob: undefined}
            })

            for await (const download of downloads) {
                const { etat } = download
                if([
                  CONST_ETAT_TRANSFERT.ETAT_PRET, 
                  CONST_ETAT_TRANSFERT.ETAT_DOWNLOAD_ENCOURS,
                  CONST_ETAT_TRANSFERT.ETAT_DOWNLOAD_SUCCES_CHIFFRE,
                  CONST_ETAT_TRANSFERT.ETAT_DOWNLOAD_SUCCES_DECHIFFRE,
                ].includes(etat)) {
                  download.etat = CONST_ETAT_TRANSFERT.ETAT_ECHEC
                    download.tailleCompletee = 0
                    await downloadFichiersDao.updateFichierDownload(download)
                }
            }

            dispatch(setDownloads(downloads))
        })
        .catch(err=>console.error("Erreur initialisation uploader ", err))
  }, [downloadFichiersDao, userId])      

  return ''
}

function supprimerDownloads(workers, dispatch, params, erreurCb) {
  const { fuuid, succes, echecs } = params
  if(fuuid) {
    Promise.resolve(dispatch(arreterDownload(workers, fuuid)))
      .catch(err=>erreurCb(err, "Erreur supprimer download"))
  }
  if(succes === true) {
    Promise.resolve(dispatch(supprimerDownloadsParEtat(workers, CONST_ETAT_TRANSFERT.ETAT_COMPLETE)))
      .catch(err=>erreurCb(err, "Erreur supprimer downloads"))
  }
  if(echecs === true) {
    Promise.resolve(dispatch(supprimerDownloadsParEtat(workers, CONST_ETAT_TRANSFERT.ETAT_ECHEC)))
      .catch(err=>erreurCb(err, "Erreur supprimer downloads"))
  }
}

function ModalTransfertEnCours(props) {
  const { show, fermer } = props
  return (
      <Modal show={show} onHide={fermer}>
          <Modal.Header closeButton>Attention</Modal.Header>
          <Modal.Body>
            <p>Des transferts sont en cours.</p>
            <p>Veuillez attendre que les transferts soient completes ou allez les annuler dans le menu Transfert de fichiers.</p>
          </Modal.Body>
          <Modal.Footer><Button onClick={fermer}>Ok</Button></Modal.Footer>
      </Modal>
  )
}
