import {useState, useEffect, useCallback} from 'react'
import axios from 'axios'
import {useDropzone} from 'react-dropzone'

import Button from 'react-bootstrap/Button'
import Col from 'react-bootstrap/Col'
import Row from 'react-bootstrap/Row'

import { FormatteurTaille } from './Formatters'

function Fichiers(props) {
    const {/*batchId, setBatchId, jwt, setJwt,*/ fichiers, setFichiers, urlPoster} = props

    const [enCours, setEnCours] = useState('')
    const [total, setTotal] = useState('')

    const onDrop = useCallback(acceptedFiles => {
        // Do something with the files
        console.debug("Accepted files : ", acceptedFiles)
        const total = acceptedFiles.reduce((acc, item)=>{
            return acc + item.size
        }, 0)
        setEnCours(0)
        setTotal(total)
        console.debug("Taille upload : ", total)
        const fichiersMaj = fichiers || []
        for(const fichier of acceptedFiles) {
            fichiersMaj.push(fichier)
        }
        setFichiers(fichiersMaj)
        // uploaderFichiers(urlPoster, batchId, jwt, acceptedFiles, setEnCours)
        //     .then(resultat=>{
        //         console.debug("Fichiers accepted : %O, resultat upload : %O", acceptedFiles, resultat)
        //         const fichiersMaj = fichiers || []
        //         for(const idx in acceptedFiles) {
        //             const accepted = acceptedFiles[idx]
        //             const uploaded = resultat.fichiers[idx]

        //             const fichier = {
        //                 nom: accepted.name,
        //                 dateFichier: Math.floor(accepted.lastModified / 1000),
        //                 taille: accepted.size,
        //                 mimetype: accepted.type,
        //                 taille_chiffre: uploaded.taille_chiffre,
        //                 fuuid: uploaded.fuuid,
        //                 nonce: uploaded.nonce,
        //                 format: uploaded.format,
        //                 cle_id: uploaded.cle_id,
        //             }
        //             fichiersMaj.push(fichier)
        //             console.debug("Liste fichiers ", fichiersMaj)
        //             setFichiers(fichiersMaj)
        //         }
        //     })
        //     .catch(err=>{
        //         console.error("Erreur upload fichiers ", err)
        //     })
        //     .finally(()=>{
        //         setEnCours('')
        //         setTotal('')
        //     }, [])
    }, [urlPoster, /*batchId, jwt,*/ setEnCours, setTotal, fichiers, setFichiers])
    const {getRootProps, getInputProps, isDragActive} = useDropzone({onDrop})

    // useEffect(()=>{
    //     if(!setBatchId || !setJwt || !urlPoster) return
    //     if(!batchId) {
    //         const urlFichiers = new URL(urlPoster)
    //         urlFichiers.pathname = urlFichiers.pathname.replace('/message', '/fichiers/dechiffres')

    //         // Creer une nouvelle session d'upload
    //         axios({method: 'GET', url: urlFichiers.href})
    //             .then(reponse=>{
    //                 console.debug("Reponse fetch ", reponse)
    //                 const {batchId, token} = reponse.data
    //                 setBatchId(batchId)
    //                 setJwt(token)
    //             })
    //             .catch(err=>console.error("Erreur chargement session fichiers", err))
    //     }
    // }, [batchId, setBatchId, setJwt])

    return (
        <div {...getRootProps()}>
            <input {...getInputProps()}/>
            <div className="fichiersDropZone">
                {
                    isDragActive?
                    'Drop fichiers ici'
                    :
                    'Peut dropper fichiers'
                }
                <ListeFichiers value={fichiers} />
            </div>
            <Button variant="secondary">Ajouter</Button>
        </div>
    )
}

export default Fichiers

// async function uploaderFichiers(urlPoster, batchId, jwt, acceptedFiles) {
//     const urlFichiers = new URL(urlPoster)
//     urlFichiers.pathname = urlFichiers.pathname.replace('/message', '/fichiers/dechiffres')

//     const urlUpload = urlFichiers.href + "/" + batchId
//     console.debug("Url upload ", urlUpload)

//     const uploadForm = {
//         'jwt': jwt,
//         'files[]': acceptedFiles
//     }    
//     return axios.putForm(urlUpload, uploadForm)
//         .then(reponse=>{
//             console.debug("Resultat upload : %O", reponse)
//             return reponse.data
//         })
// }

function ListeFichiers(props) {
    const {value} = props

    if(!value || value.length === 0) return ''

    return (
        <div>
            {value.map(item=><Fichier key={item.name} value={item} />)}
        </div>
    )
}

function Fichier(props) {
    const {value} = props

    return (
        <Row className="fichier">
            <Col className="bouton" xs={2} sm={1}>
                <Button className="btn-sm" variant="danger">X</Button>
            </Col>
            <Col className="nom">{value.name}</Col>
            <Col className="taille" xs={3} md={2} lg={1}><FormatteurTaille value={value.size}/></Col>
        </Row>
    )
}
