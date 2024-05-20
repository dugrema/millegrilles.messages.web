import {lazy, useState, useCallback} from 'react'

import Container from 'react-bootstrap/Container'
import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

const QuillEditor = lazy(()=>import('./QuillEditor'))

const COLS_LABEL = {xs: 12, md: 3, lg: 2}

function PosterMessage(props) {

    const [destinataire, setDestinataire] = useState('')
    const [auteur, setAuteur] = useState('')
    const [repondre, setRepondre] = useState('')
    const [contenu, setContenu] = useState('')

    const destinataireHandler = useCallback(e=>setDestinataire(e.currentTarget.value), [setDestinataire])
    const auteurHandler = useCallback(e=>setAuteur(e.currentTarget.value), [setAuteur])
    const repondreHandler = useCallback(e=>setRepondre(e.currentTarget.value), [setRepondre])

    const submitHandler = useCallback(e=>{
        e.stopPropagation()
        e.cancelDefault()
        console.debug("Submit form")
    }, [])

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
                    <Col>
                        <Form.Control 
                            type='text'
                            placeholder='e.g. proprietaire alicebobba'
                            aria-label='Destinataire' 
                            value={destinataire}
                            onChange={destinataireHandler} />
                        <Form.Text id="passwordHelpBlock" muted>
                            Destinataires. Séparer les noms d'usager par un espace.
                        </Form.Text>
                    </Col>
                </Form.Group>

                <QuillEditor value={contenu} onChange={setContenu} />

                <Row className='boutons'>
                    <Col>
                        <Button>Poster</Button>
                        <Button variant="secondary">Reset</Button>
                    </Col>
                </Row>

            </Form>
        </Container>
    )
}

export default PosterMessage
