import { proxy } from 'comlink'
import { idmg as idmgUtils } from '@dugrema/millegrilles.reactjs'

const URL_SOCKET = '/messages/socket.io'

export async function connecter(workers, setUsagerState, setEtatConnexion, setEtatFormatteurMessage) {
    // console.debug("!!! setEtatConnexion :%O, setEtatFormatteur : %O", setEtatConnexion, setEtatFormatteurMessage)
    const { connexion } = workers
  
    // console.debug("Set callbacks connexion worker")
    const location = new URL(window.location.href)
    location.pathname = URL_SOCKET
    console.info("Connecter a %O", location.href)

    // Preparer callbacks
    const setUsagerCb = proxy( usager => setUsager(workers, usager, setUsagerState) )
    const setEtatConnexionCb = proxy(setEtatConnexion)
    const setEtatFormatteurMessageCb = proxy(setEtatFormatteurMessage)

    // await connexion.setCallbacks(setEtatConnexionCb, setUsagerCb, setEtatFormatteurMessageCb)

    // // return connexion.connecter(location.href, {DEBUG: true})
    // return connexion.connecter(location.href, {reconnectionDelay: 5_000})

    await connexion.configurer(location.href, setEtatConnexionCb, setUsagerCb, setEtatFormatteurMessageCb, 
        {DEBUG: true, reconnectionDelay: 5_000})

    return connexion.connecter()
}

export default connecter

async function setUsager(workers, nomUsager, setUsagerState, opts) {
    opts = opts || {}

    // Desactiver usager si deja connecte - permet de reauthentifier 
    // (i.e. useEtatPret === false tant que socket serveur pas pret)
    await setUsagerState('')

    // console.debug("setUsager '%s'", nomUsager)
    const { usagerDao, forgecommon } = await import('@dugrema/millegrilles.reactjs')
    const { pki } = await import('@dugrema/node-forge')
    const { extraireExtensionsMillegrille } = forgecommon
    const usager = await usagerDao.getUsager(nomUsager)
    console.debug("Usager info : %O", usager)
    
    if(usager && usager.certificat) {
        const { connexion, chiffrage } = workers
        const fullchain = usager.certificat,
              caPem = usager.ca

        const certificatPem = fullchain.join('')

        // Calculer le idmg
        const idmg = await idmgUtils.getIdmg(caPem)

        // Initialiser le CertificateStore
        // await chiffrage.initialiserCertificateStore(caPem, {isPEM: true, DEBUG: false})

        // Init cles privees
        await chiffrage.initialiserFormatteurMessage(certificatPem, usager.clePriveePem, {DEBUG: false})
        await connexion.initialiserFormatteurMessage(certificatPem, usager.clePriveePem, {DEBUG: false})
    
        const certForge = pki.certificateFromPem(fullchain[0])
        const extensions = extraireExtensionsMillegrille(certForge)

        const reponseAuthentifier = await workers.connexion.authentifier()
        console.debug("Reponse authentifier : %O", reponseAuthentifier)
        if(!reponseAuthentifier || reponseAuthentifier.protege !== true) { // throw new Error("Echec authentification (protege=false)")
            console.error("Erreur authentification : reponseAuthentifier = %O", reponseAuthentifier)
            return
        }

        const socketioAuth = reponseAuthentifier.protege

        // setUsagerState({nomUsager, fullchain, extensions})
        const usagerState = {...usager, idmg, nomUsager, extensions, auth: socketioAuth, socketioAuth: socketioAuth}
        console.info("Usager state %O", usagerState)
        await setUsagerState(usagerState)

    } else {
        console.warn("Pas de certificat pour l'usager '%s'", usager)
    }    

}
