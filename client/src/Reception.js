import {lazy, useState, useEffect, useMemo} from 'react'
import Row from 'react-bootstrap/Row'
import Col from 'react-bootstrap/Col'

import { useDispatch, useSelector } from 'react-redux'

import useWorkers from './WorkerContext'
// import {  } from './redux/messagesSlice'

import ListeMessages from './ListeMessages'
const AfficherMessage = lazy( () => import('./AfficherMessage') )

function Reception(props) {

    const [messageSelectionne, setMessageSelectionne] = useState('')

    return (
        <ReceptionLayout2Colonnes 
            messageSelectionne={messageSelectionne}
            setMessageSelectionne={setMessageSelectionne}
        />
    )
}

export default Reception

function ReceptionLayout2Colonnes(props) {
    const {messageSelectionne, setMessageSelectionne} = props

    return (
        <Row>
            <Col md={5} lg={4} xl={3}>
                <p>Messages reçus</p>
                <ListeMessages onChange={setMessageSelectionne} value={messageSelectionne} />
            </Col>
            <Col className="d-none d-md-block">
                <AfficherMessage value={messageSelectionne} />
            </Col>
        </Row>
    )
}
