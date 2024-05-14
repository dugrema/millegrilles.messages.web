import {useState, useEffect, useMemo} from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import { useDispatch, useSelector } from 'react-redux'

import useWorkers from './WorkerContext'
// import {  } from './redux/messagesSlice'


function Reception(props) {
    return (
        <div>
            <p>Reception</p>
            <ListeMessages />
        </div>
    )
}

export default Reception

function ListeMessages(props) {
    const messages = useSelector(item=>item.messages.listeMessages)

    const messagesMappes = useMemo(()=>{
        if(!messages || messages.length === 0) return []

        const messagesMappes = messages.map(item=>{
            return <Row key={item.message_id}><Col>Message {item.date_post}</Col></Row>
        })
        
        return messagesMappes
    }, [messages])

    return (
        <div>
            Messages
            {messagesMappes}
        </div>
    )
}
