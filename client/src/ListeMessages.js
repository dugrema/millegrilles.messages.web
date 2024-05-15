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
            return <MessageRow key={item.message_id} value={item} onClick={onClick} />
        })
        
        return messagesMappes
    }, [messages])

    return (
        <div>
            {messagesMappes}
        </div>
    )
}

export default ListeMessages

function MessageRow(props) {
    const {onClick, value} = props

    return (
        <div onClick={onClick} data-id={value.message_id}>
            <Row>
                <Col>
                    <FormatterDate value={value.date_post} />
                </Col>
            </Row>
            <Row>
                <Col>{value.sujet}</Col>
            </Row>
            <hr/>
        </div>
    )
}
