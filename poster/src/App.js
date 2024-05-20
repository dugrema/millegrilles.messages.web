import {lazy, Suspense, useState, useEffect} from 'react'

import './App.css'
import './index.scss'

const PosterMessage = lazy(()=>import('./PosterMessage'))

function App() {

  const [urlPoster, setUrlPoster] = useState('')

  return (
    <div className="App">
      <Suspense load={Loading}>
        <PosterMessage urlPoster={urlPoster} />
      </Suspense>
      <TrouverAdresseServeur setUrlPoster={setUrlPoster} />
    </div>
  );
}

export default App;

function Loading(props) {
  return 'loading'
}

function TrouverAdresseServeur(props) {
  const {setUrlPoster} = props

  useEffect(()=>{
    if(!setUrlPoster) return

    let urlMessage = `https://${window.location.host}/reception/message`
    fetch('./config.json')
      .then(async reponse => {
        const reponseContenu = await reponse.json()
        console.debug("Reponse config.json ", reponseContenu)
        const {local, urlPoster, urlInstances} = reponseContenu
        if(local) {
          urlMessage = `https://${window.location.hostname}/reception/message`
        } else if(urlPoster) {
          urlMessage = urlPoster
        } else if(urlInstances) {
          throw new Error("todo - charger fiches")
        }
      })
      .catch(err=>{
        console.error("Erreur chargement config.json, utilisation default ", err)
      })
      .finally(()=>{
        console.debug("Url local : ", urlMessage)
        setUrlPoster(urlMessage)
      })
  }, [setUrlPoster])

  return ''
}
