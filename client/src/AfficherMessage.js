import {useState, useEffect, useMemo} from 'react'
import ReactQuill from 'react-quill'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import { FormatterDate } from '@dugrema/millegrilles.reactjs'

import useWorkers from './WorkerContext'

function AfficherMessage(props) {

    const {value} = props
    const workers = useWorkers()

    const [message, setMessage] = useState('')

    useEffect(()=>{
        if(value) {
            // Charger le message
            workers.messagesDao.getMessage(value)
                .then(messageIdb=>{
                    console.debug("Message charge : ", messageIdb)
                    setMessage(messageIdb)
                })
                .catch(err=>console.error("Erreur chargement message %s : %O", value, err))
        } else {
            setMessage('')
        }
    }, [workers, value, setMessage])

    if(message) {
        return <Message value={message} />
    }

    return 'Aucun message selectionne'
}

export default AfficherMessage

function Message(props) {
    const {value} = props

    return (
        <div>
            <EnteteMessage value={value} />
            <ContenuMessage value={value} />
        </div>
    )
}

function EnteteMessage(props) {
    const {value} = props

    const COL_LABEL = {sm: 4, md: 3}

    return (
        <div>
            <Row>
                <Col {...COL_LABEL}>Date</Col>
                <Col><FormatterDate value={value.message.date_post}/></Col>
            </Row>
            <Row>
                <Col {...COL_LABEL}>Destinataires</Col>
                <Col><Destinataires value={value.message.destinataires}/></Col>
            </Row>
        </div>
    )
}

function Destinataires(props) {
    const {value} = props

    const destinataires = useMemo(()=>{
        if(!value || value.length === 0) return []
        const mapping = value.map((item, idx)=>{
            let sep = <span>, </span>
            if(idx === 0) sep = ''
            return (
                <span key={idx}>{item}{sep}</span>
            )
        })
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
