import {useState, useEffect, useMemo, useCallback} from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import { useDispatch, useSelector } from 'react-redux'

import { FormatterDate } from '@dugrema/millegrilles.reactjs'

import useWorkers from './WorkerContext'
// import {  } from './redux/messagesSlice'

function ListeMessages(props) {
    const { onChange, value } = props

    const messages = useSelector(item=>item.messages.listeMessages)

    const onClick = useCallback(e=>{
        const message_id = e.currentTarget.dataset.id
        console.debug("Message id : ", message_id)
        onChange(message_id)
    }, [onChange])

    const messagesMappes = useMemo(()=>{
        if(!messages || messages.length === 0) return []

        const messagesMappes = messages.map(item=>{
            return <MessageRow key={item.message_id} value={item} onClick={onClick} selectionne={item.message_id === value} />
        })
        
        return messagesMappes
    }, [messages, value])

    return (
        <div>
            <StatsMessages />
            <div className="messageliste">
                {messagesMappes}
            </div>
        </div>
    )
}

export default ListeMessages

function StatsMessages(props) {
    const listeMessages = useSelector(item=>item.messages.listeMessages)

    const stats = useMemo(()=>{
        if(!listeMessages) return {total: 0, nonLus: 0}
        return listeMessages.reduce((acc, item)=>{
            if(!item.lu) acc.nonLus++
            acc.total++
            return acc
        }, {total: 0, nonLus: 0})
    }, [listeMessages])

    return (
        <Row>
            <Col>
                Nombre : {stats.total} (non lus: {stats.nonLus})
            </Col>
        </Row>
    )
}

function MessageRow(props) {
    const {onClick, value, selectionne} = props

    const classNameDiv = useMemo(()=>{
        let classes = []
        if(value.lu) classes.push('lu')
        if(selectionne) classes.push('selectionne')
        return classes.join(' ')
    }, [value, selectionne])

    return (
        <div onClick={onClick} data-id={value.message_id} className={classNameDiv}>
            <Row>
                <Col>
                    <FormatterDate value={value.date_post||value.date_traitement} />
                </Col>
            </Row>
            {value.auteur?
                <Row className="auteur">
                    <Col>{value.auteur}</Col>
                </Row>
            :''}
            {value.sujet?
                <Row className="sujet">
                    <Col>{value.sujet.slice(0, 100)}</Col>
                </Row>
            :''}
        </div>
    )
}
