import React, {Suspense, useState, useEffect, useMemo, useCallback} from 'react'
import { proxy as comlinkProxy } from 'comlink'
import { useTranslation } from 'react-i18next'

import { Provider as ReduxProvider, useDispatch } from 'react-redux'

import Container from 'react-bootstrap/Container'

import ErrorBoundary from './ErrorBoundary'
import useWorkers, {useEtatConnexion, useEtatConnexionOpts, WorkerProvider, useUsager, useFormatteurPret, useInfoConnexion, useEtatPret} from './WorkerContext'
import storeSetup from './redux/store'

import { setUserId as setUserIdMessages, pushDirty, thunks as thunksMessages } from './redux/messagesSlice'

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

// Wire i18n dans module @dugrema/millegrilles.reactjs
initI18n(i18n)

const Menu = React.lazy( () => import('./Menu') )
const Accueil = React.lazy( () => import('./Accueil') )
const Reception = React.lazy( () => import('./Reception') )

// const _contexte = {}  // Contexte global pour comlink proxy callbacks

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
  const usager = useUsager()
  const etatConnexion = useEtatConnexion()
  const etatConnexionOpts = useEtatConnexionOpts()
  const etatFormatteurMessage = useFormatteurPret()
  const infoConnexion = useInfoConnexion()

  const [sectionAfficher, setSectionAfficher] = useState('')
  const [erreur, setErreur] = useState('')
  
  const handlerCloseErreur = () => setErreur(false)

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
        setSectionAfficher={setSectionAfficher} />
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

        <ModalErreur show={!!erreur} err={erreur.err} message={erreur.message} titre={t('Erreur.titre')} fermer={handlerCloseErreur} />
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
