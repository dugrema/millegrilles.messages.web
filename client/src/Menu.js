import React, {useState, useMemo, useCallback, useEffect} from 'react'
import { useTranslation } from 'react-i18next'

import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import NavDropdown from 'react-bootstrap/NavDropdown'

import { Menu as MenuMillegrilles, DropDownLanguage, ModalInfo } from '@dugrema/millegrilles.reactjs'
import { supprimerContenuIdb } from '@dugrema/millegrilles.reactjs/src/dbNettoyage'

import {useEtatConnexion, useUsager, useInfoConnexion, useIdmg } from './WorkerContext'

function Menu(props) {

    const { i18n, setSectionAfficher, estProprietaire } = props
  
    const [manifest, setManifest] = useState()

    // useEffect(()=>{
    //   import('./manifest.build')
    //     .then(manifest=>{
    //       console.debug("Manifest : ", manifest)
    //       setManifest(manifest)
    //     })
    //     .catch(err=>{
    //       console.warn("Erreur chargement manifest : %O", err)
    //       setManifest(false)
    //     })
    // }, [setManifest])

    const usager = useUsager()
    const etatConnexion = useEtatConnexion()
  
    const idmg = useMemo(()=>{
      if(!usager) return null
      return usager.idmg
    }, [usager])
  
    const { t } = useTranslation()
    const [showModalInfo, setShowModalInfo] = useState(false)
    const handlerCloseModalInfo = useCallback(()=>setShowModalInfo(false), [setShowModalInfo])
  
    const handlerSelect = useCallback(eventKey => {
        switch(eventKey) {
          case 'portail': window.location = '/millegrilles'; break
          case 'deconnecter': deconnecter(usager.nomUsager); break
          case 'instances': setSectionAfficher('Instances'); break
          case 'configuration': setSectionAfficher('Configuration'); break
          case 'information': setShowModalInfo(true); break
          default:
            setSectionAfficher('')
        }
    }, [setSectionAfficher, setShowModalInfo])
  
    const handlerChangerLangue = eventKey => {i18n.changeLanguage(eventKey)}
    const brand = (
        <Navbar.Brand>
            <Nav.Link onClick={handlerSelect} title={t('titre')}>
                {t('titre')}
            </Nav.Link>
        </Navbar.Brand>
    )
  
    return (
        <>
            <MenuMillegrilles 
                brand={brand} 
                labelMenu="Menu" 
                etatConnexion={etatConnexion} 
                onSelect={handlerSelect} 
                i18nInstance={i18n}>
  
              {estProprietaire?
                <Nav.Link eventKey="instances" title="Gerer instances/relais">
                  {t('menu.instances')}
                </Nav.Link>
              :''}
  
              <Nav.Link eventKey="configuration" title="Configuration des appareils">
                  {t('menu.configuration')}
              </Nav.Link>
  
              <Nav.Link eventKey="information" title="Afficher l'information systeme">
                  {t('menu.information')}
              </Nav.Link>
              <DropDownLanguage title={t('menu.language')} onSelect={handlerChangerLangue}>
                  <NavDropdown.Item eventKey="en-US">English</NavDropdown.Item>
                  <NavDropdown.Item eventKey="fr-CA">Francais</NavDropdown.Item>
              </DropDownLanguage>
              <Nav.Link eventKey="portail" title={t('menu.portail')}>
                  {t('menu.portail')}
              </Nav.Link>
              <Nav.Link eventKey="deconnecter" title={t('menu.deconnecter')}>
                  {t('menu.deconnecter')}
              </Nav.Link>
  
            </MenuMillegrilles>
            <ModalInfo 
                show={showModalInfo} 
                fermer={handlerCloseModalInfo} 
                manifest={manifest} 
                idmg={idmg} 
                usager={usager} />
        </>
    )
  }

  export default Menu

async function deconnecter(nomUsager) {
    try {
      await supprimerContenuIdb({nomUsager})
    } catch (err) {
      console.error("deconnecter Erreur nettoyage IDB : ", err)
    } finally {
      window.location = '/auth/deconnecter_usager'
    }
}