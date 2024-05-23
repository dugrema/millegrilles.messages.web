import React, {useState, useMemo, useCallback, useEffect} from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Nav from 'react-bootstrap/Nav'
import Navbar from 'react-bootstrap/Navbar'
import NavDropdown from 'react-bootstrap/NavDropdown'
import Badge from 'react-bootstrap/Badge'

import { Menu as MenuMillegrilles, DropDownLanguage, ModalInfo } from '@dugrema/millegrilles.reactjs'
import { supprimerContenuIdb } from '@dugrema/millegrilles.reactjs/src/dbNettoyage'

import {useEtatConnexion, useUsager, useInfoConnexion, useIdmg } from './WorkerContext'

import * as CONST_ETAT_TRANSFERT from './transferts/constantes'

function Menu(props) {

    const { i18n, setSectionAfficher, estProprietaire, etatTransfert, showTransfertModal } = props
  
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
          case 'reception': setSectionAfficher('Reception'); break
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
  
    const transfert = (
      <Nav.Item>
        <Nav.Link title="Upload/Download" onClick={showTransfertModal}>
            <LabelTransfert etatTransfert={etatTransfert} />
        </Nav.Link>
    </Nav.Item>
    )
  
    return (
        <>
            <MenuMillegrilles 
                brand={brand} 
                labelMenu="Menu" 
                etatConnexion={etatConnexion} 
                transfer={transfert}
                onSelect={handlerSelect} 
                i18nInstance={i18n}>
  
              <Nav.Link eventKey="reception" title="Reception">
                {t('menu.reception')}
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

function LabelTransfert(props) {
  return (
    <div className="transfer-labels">
      <BadgeDownload />
    </div>
  )
}

function BadgeDownload(props) {
  const downloads = useSelector(state=>state.downloader.liste),
        progresDownload = useSelector(state=>state.downloader.progres)

  const downloadsResultat = useMemo(()=>{
    const valeur = {encours: 0, succes: 0, erreur: 0}

    const resultat = downloads.reduce((nb, item)=>{
      let {encours, succes, erreur} = nb
      switch(item.etat) {
        case CONST_ETAT_TRANSFERT.ETAT_PRET:
        case CONST_ETAT_TRANSFERT.ETAT_DOWNLOAD_ENCOURS:
            encours++
          break
        case CONST_ETAT_TRANSFERT.ETAT_COMPLETE:
          succes++
          break
        case CONST_ETAT_TRANSFERT.ETAT_ECHEC:
          erreur++
          break
        default:
      }
      return {encours, succes, erreur}
    }, valeur)
    return resultat
  }, [downloads])

  let variantDownload = 'secondary'
  if(downloadsResultat.erreur>0) variantDownload = 'danger'
  else if(downloads.length>0) variantDownload = 'success'

  let labelDownload = <span>---</span>
  if(!isNaN(progresDownload)) labelDownload = <span>{Math.floor(progresDownload)} %</span>

  return <BadgeTransfer className='fa fa-download' variant={variantDownload} label={labelDownload} />
}

function BadgeTransfer(props) {
  const { className, variant, label } = props
  return (
    <span className='badge-transfert'>
      <i className={className} />
      <Badge pill bg={variant}>{label}</Badge>
    </span>
  )
}

async function deconnecter(nomUsager) {
    try {
      await supprimerContenuIdb({nomUsager})
    } catch (err) {
      console.error("deconnecter Erreur nettoyage IDB : ", err)
    } finally {
      window.location = '/auth/deconnecter_usager'
    }
}