import {lazy, useState, useCallback, useEffect, useMemo} from 'react'

import Container from 'react-bootstrap/Container'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Alert from 'react-bootstrap/Alert'

const QuillEditor = lazy(()=>import('./QuillEditor'))

const COLS_LABEL = {xs: 12, md: 3, lg: 2}

function PosterMessage(props) {

    const {urlPoster, destinataires: destinatairesForces} = props

    const [destinataires, setDestinataires] = useState('')
    const [auteur, setAuteur] = useState('')
    const [repondre, setRepondre] = useState('')
    const [contenu, setContenu] = useState('')

    const [attente, setAttente] = useState(false)
    const [succes, setSucces] = useState('')
    const [erreur, setErreur] = useState('')

    const destinatairesHandler = useCallback(e=>setDestinataires(e.currentTarget.value), [setDestinataires])

    const resetHandler = useCallback(()=>{
        setDestinataires('')
        setContenu('')
        setSucces('')
        setErreur('')
        setAttente(false)
    }, [setDestinataires, setContenu, setSucces, setErreur, setAttente])

    const auteurHandler = useCallback(e=>{
        const auteur = e.currentTarget.value
        setAuteur(auteur)
        window.localStorage.setItem('poster.auteur', auteur)
    }, [setAuteur])

    const repondreHandler = useCallback(e=>{
        const repondre = e.currentTarget.value
        setRepondre(repondre)
        window.localStorage.setItem('poster.repondre', repondre)
    }, [setRepondre])

    const confirmerHandler = useCallback(data => {
        console.debug("Confirmation du resultat : ", data)
        if(data.ok) {
            resetHandler()

            if(data.code === 201) {
                setSucces('Message transmis avec succes')
            } else if(data.code === 1) {
                setErreur(data.err)
            } else if(data.code === 200) {
                setSucces('Message transmis pour certains destinataires. ' + data.err)
            } else {
                setSucces('Message transmis avec avertissements : ', data.err)
            }
            
            setTimeout(()=>setSucces(''), 15_000)
        } else {
            setErreur('Echec : ', data.err)
        }
    }, [setSucces, setErreur, resetHandler])

    const submitHandler = useCallback(e=>{
        e.stopPropagation()
        e.preventDefault()
        setAttente(true)
        let destinatairesEffectifs = destinatairesForces
        if(!destinatairesEffectifs) destinatairesEffectifs = destinataires
        poster(urlPoster, auteur, repondre, destinatairesEffectifs, contenu)
            .then(confirmerHandler)
            .catch(err=>{
                setErreur(''+err)
            })
            .finally(()=>setAttente(false))
    }, [urlPoster, auteur, repondre, destinataires, destinatairesForces, contenu, setAttente, setErreur, confirmerHandler])

    useEffect(()=>{
        if(!setAuteur || !setRepondre) return
        const auteur = window.localStorage.getItem('poster.auteur') || ''
        const repondre = window.localStorage.getItem('poster.repondre') || ''
        setAuteur(auteur)
        setRepondre(repondre)
    }, [setAuteur, setRepondre])

    useEffect(()=>{
        if(destinatairesForces) {
            setDestinataires(destinatairesForces.join(' '))
        }
    }, [destinatairesForces, setDestinataires])

    const destinatairesForcesListe = useMemo(()=>{
        if(!destinatairesForces) return ''
        return destinatairesForces.map((item, idx)=>{
            return <span key={''+idx} className="destinataire">{item}</span>
        })
    }, [destinatairesForces])

    if(!urlPoster) {
        return <p>Chargement de l'information en cours...</p>
    }

    return (
        <Container>
            <h1>Poster un message</h1>

            <Form onSubmit={submitHandler}>

                <Form.Group as={Row}>
                    <Form.Label {...COLS_LABEL} as={Col}>Votre nom</Form.Label>
                    <Col>
                        <Form.Control 
                            type='text'
                            placeholder='Alice Bobba' 
                            aria-label='Votre nom' 
                            value={auteur}
                            onChange={auteurHandler} />
                    </Col>
                </Form.Group>
                
                <Form.Group as={Row}>
                    <Form.Label {...COLS_LABEL} as={Col}>Adresse réponse</Form.Label>
                    <Col>
                        <Form.Control 
                            type='text'
                            placeholder='e.g. alice_bobba@hotmail.com' 
                            aria-label='Adresse réponse' 
                            value={repondre}
                            onChange={repondreHandler} />
                        <Form.Text id="passwordHelpBlock" muted>
                            Optionnel. Méthode pour vous rejoindre.
                        </Form.Text>
                    </Col>
                </Form.Group>
                
                <Form.Group as={Row}>
                    <Form.Label {...COLS_LABEL} as={Col}>Destinataires</Form.Label>
                    <Col className='destinataires'>
                    {destinatairesForcesListe?
                        <>{destinatairesForcesListe}</>
                        :
                        <>
                            <Form.Control 
                                type='text'
                                placeholder='e.g. proprietaire alicebobba'
                                aria-label='Destinataire' 
                                value={destinataires}
                                onChange={destinatairesHandler} />
                            <Form.Text id="passwordHelpBlock" muted>
                                Destinataires. Séparer les noms d'usager par un espace.
                            </Form.Text>
                        </>
                    }
                    </Col>
                </Form.Group>

                <QuillEditor value={contenu} onChange={setContenu} />

                <Alert show={attente} variant="primary">
                    <Alert.Heading>Transmission</Alert.Heading>
                    <p>Transmission du message en cours</p>
                </Alert>

                <Alert show={!!succes} dismissible variant="success">
                    <Alert.Heading>Message transmis</Alert.Heading>
                    <p>{succes}</p>
                </Alert>

                <Alert show={!!erreur} variant="danger" dismissible onClose={()=>setErreur('')}>
                    <Alert.Heading >Erreur</Alert.Heading>
                    <p>{erreur}</p>
                </Alert>

                <Row className='boutons'>
                    <Col>
                        <Button type='submit' disabled={attente}>Poster</Button>
                        <Button variant="secondary" onClick={resetHandler} disabled={attente}>Reset</Button>
                    </Col>
                </Row>

            </Form>
        </Container>
    )
}

export default PosterMessage


async function poster(urlPoster, auteur, repondre, destinataires, contenu) {
    const axios = (await import('axios')).default

    if(typeof(destinataires) === 'string') destinataires = destinataires.split(' ')
    
    if(destinataires.length === 0) {
        throw new Error("Il faut au moins 1 destinataire")
    }
    if(!contenu || contenu === '') {
        throw new Error("Le contenu ne doit pas etre vide")
    }

    console.debug("Poster a %O contenu %O", destinataires, contenu)
    console.debug("Auteur : %s\nRepondre : %s", auteur, repondre)
    const posterURL = new URL(urlPoster)
    console.debug("URL poster : %O", posterURL)

    const message = preparerMessage(auteur, repondre, destinataires, contenu)
    console.debug("Poster ", message)
    const reponse = await axios({method: 'POST', url: posterURL.href, data: message, timeout: 20_000})

    console.debug("Repondre POST : ", reponse)
    return reponse.data
}

function preparerMessage(auteur, repondre, destinataires, contenu) {
    const message = {
        destinataires, contenu
    }
    if(auteur) message.auteur = auteur
    if(repondre) message.reply_to = repondre

    return message
}
