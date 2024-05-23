import { base64 } from 'multiformats/bases/base64'

const CONST_TIMEOUT_CERTIFICAT = 2 * 60 * 1000

function build(workers) {

    let cacheCertificatsMaitredescles = null

    return {
        // Recupere une liste de cles, les conserve dans le usagerDao (cache) si applicable
        getCles(cleIds, opts) {
            return getCles(workers, cleIds, opts)
        },
        getCertificatsMaitredescles() {
            if(cacheCertificatsMaitredescles) return cacheCertificatsMaitredescles
            return getCertificatsMaitredescles(workers)
                .then(reponse=>{
                    cacheCertificatsMaitredescles = reponse
                    setTimeout(()=>{
                        cacheCertificatsMaitredescles = null
                    }, CONST_TIMEOUT_CERTIFICAT)
                    return reponse
                  })
        }
    }
}

export default build

async function getCles(workers, cle_ids, opts) {
    console.debug("getCles cle_ids %s, opts: %O", cle_ids, opts)
    opts = opts || {}
    const estCleFichier = !!opts.estCleFichier

    if(typeof(cle_ids) === 'string') cle_ids = [cle_ids]

    const { connexion, usagerDao } = workers

    const clesManquantes = [],
          clesDechiffrees = {}

    // Recuperer cles connues localement
    for await (const hachage_bytes of cle_ids) {
        const cleDechiffree = await usagerDao.getCleDechiffree(hachage_bytes)
        if(cleDechiffree) {
            clesDechiffrees[hachage_bytes] = cleDechiffree
        } else {
            clesManquantes.push(hachage_bytes)
        }
    }

    // console.debug("Cles connues : %d, cles manquantes : %d", Object.keys(clesDechiffrees).length, clesManquantes.length)
    if(clesManquantes.length > 0) {
        // Recuperer les cles du serveur
        const reponseClesChiffrees = await connexion.dechiffrerCles(cle_ids, estCleFichier)
        // console.debug("getCles reponseClesChiffrees ", reponseClesChiffrees)

        // Nouvelle methode avec reponse chiffree (V2)
        if(!reponseClesChiffrees.ok) {
            throw new Error(`Erreur recuperation cles : ${reponseClesChiffrees.err}`)
        }
        const cles = reponseClesChiffrees.cles
        for(const cle of cles) {
            const cleSecrete = base64.decode('m'+cle.cle_secrete_base64)
            const { format, nonce, verification, cle_id } = cle
            // Sauvegarder la cle pour reutilisation
            const infoCle = {hachage_bytes: cle_id, cleSecrete, format, nonce, verification}
            clesDechiffrees[cle_id] = infoCle
            usagerDao.saveCleDechiffree(cle_id, cleSecrete, infoCle)
                .catch(err=>{
                    console.warn("clesDao.getCles Erreur sauvegarde cle dechiffree %s dans la db locale", err)
                })            
        }
    }

    return clesDechiffrees
}

async function getCertificatsMaitredescles(workers) {
    const { connexion } = workers
    return connexion.getCertificatsMaitredescles()
}
