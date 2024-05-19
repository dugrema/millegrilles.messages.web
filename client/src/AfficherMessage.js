import {useState, useEffect, useMemo, useCallback} from 'react'
import ReactQuill from 'react-quill'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'
import Button from 'react-bootstrap/Button'

import { FormatterDate } from '@dugrema/millegrilles.reactjs'

import useWorkers from './WorkerContext'

function AfficherMessage(props) {

    const {value} = props
    const workers = useWorkers()

    const [message, setMessage] = useState('')

    const supprimerMessageHandler = useCallback(()=>{
        workers.connexion.supprimerMessage(message.message_id)
            .catch(err=>console.error("Erreur supprimer message : ", err))
    }, [workers, message])

    useEffect(()=>{
        if(value) {
            // Charger le message
            workers.messagesDao.getMessage(value)
                .then(messageIdb=>{
                    console.debug("Message charge : ", messageIdb)
                    setMessage(messageIdb)

                    if(messageIdb.lu !== true) {
                        // Marquer message comme lu
                        workers.connexion.marquerLu(value)
                            .catch(err=>console.warn("Erreur marquer message %s lu : %O", value, err))
                    }
                })
                .catch(err=>console.error("Erreur chargement message %s : %O", value, err))
        } else {
            setMessage('')
        }
    }, [workers, value, setMessage])

    if(message) {
        return <Message value={message} onSupprimerMessage={supprimerMessageHandler} />
    }

    return 'Aucun message selectionne'
}

export default AfficherMessage

function Message(props) {
    const {value, onSupprimerMessage} = props

    return (
        <div>
            <EnteteMessage value={value} onSupprimerMessage={onSupprimerMessage} />
            <ContenuMessage value={value} />
        </div>
    )
}

function EnteteMessage(props) {
    const {value, onSupprimerMessage} = props

    const COL_LABEL = {sm: 4, md: 3}

    const [auteur, replyTo] = useMemo(()=>{
        if(!value || !value.message) return [null, null]
        const replyTo = value.message.reply_to
        let auteur = value.message.auteur || replyTo
        return [auteur, replyTo]
    }, [value])

    return (
        <div>
            <Row>
                <Col {...COL_LABEL}>Date</Col>
                <Col><FormatterDate value={value.message.date_post}/></Col>
            </Row>
            {auteur?
                <Row>
                    <Col {...COL_LABEL}>Auteur</Col>
                    <Col>{auteur}</Col>
                </Row>
            :''}
            <Row>
                <Col {...COL_LABEL}>Destinataires</Col>
                <Col><Destinataires value={value.message.destinataires}/></Col>
            </Row>
            <BoutonsMessage replyTo={replyTo} onSupprimerMessage={onSupprimerMessage} />
        </div>
    )
}

function BoutonsMessage(props) {
    const {replyTo, onSupprimerMessage} = props
    
    return (
        <Row className="buttonbar">
            <Col>
                <Button variant="secondary" disabled={!replyTo} title='repondre'><i className="fa fa-reply"/></Button>
                <Button variant="secondary" title='transferer'><i className="fa fa-mail-forward"/></Button>
                <Button variant="danger" title='supprimer' onClick={onSupprimerMessage}><i className="fa fa-trash"/></Button>
            </Col>
        </Row>
    )
}

function Destinataires(props) {
    const {value} = props

    const destinataires = useMemo(()=>{
        if(!value || value.length === 0) return []
        const mapping = value.join(', ')
        return mapping
    }, [value])

    return (
        <div>{destinataires}</div>
    )
}

function ContenuMessage(props) {
    const {value} = props
    return (
        <>
            <hr/>
            <ReactQuill className="afficher" value={value.message.contenu} readOnly={true} theme=''/>
            <br className="clear"/>
        </>
    )
}
