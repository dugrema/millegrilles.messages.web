import React, {useState, useEffect, useCallback, useMemo} from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { proxy } from 'comlink'

import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import { FormatterDate } from '@dugrema/millegrilles.reactjs'

import useWorkers, {useEtatPret} from './WorkerContext'
import { push as pushAppareils, mergeAppareil } from './redux/appareilsSlice'

// const AfficherSenseurs = React.lazy( () => import('./AfficherSenseurs') )
// const SenseurDetail = React.lazy( () => import('./SenseurDetail') )

function Accueil(props) {

  const workers = useWorkers()
  const etatPret = useEtatPret()
  const dispatch = useDispatch()

  // // Messages, maj liste appareils
  // const messageAppareilHandler = useCallback(evenement=>{
  //   const { routingKey, message } = evenement
  //   // console.debug("Message appareil : %O", message)
  //   const action = routingKey.split('.').pop()
  //   if(['lectureConfirmee', 'majAppareil', 'presenceAppareil'].includes(action)) {
  //     dispatch(mergeAppareil(message))
  //   }
  // }, [dispatch])

  // const messageAppareilHandlerProxy = useMemo(()=>{
  //   return proxy(messageAppareilHandler)
  // }, [messageAppareilHandler])

  // Rendering

  // Page accueil
  return (
    <div>
      <p>Accueil</p>
    </div>
  )

}

export default Accueil
