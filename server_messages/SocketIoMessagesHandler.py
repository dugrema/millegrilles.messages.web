import asyncio
import logging

from millegrilles_messages.messages import Constantes
from millegrilles_messages.messages.ValidateurCertificats import CertificatInconnu
from millegrilles_web.SocketIoHandler import SocketIoHandler, ErreurAuthentificationMessage

from server_messages import Constantes as ConstantesMessages


class SocketIoMessagesHandler(SocketIoHandler):

    def __init__(self, app, stop_event: asyncio.Event):
        self.__logger = logging.getLogger(__name__ + '.' + self.__class__.__name__)
        super().__init__(app, stop_event)

    async def _preparer_socketio_events(self):
        await super()._preparer_socketio_events()

        self._sio.on('syncMessages', handler=self.requete_sync_messages)
        self._sio.on('getMessagesParIds', handler=self.requete_messages_par_ids)
        self._sio.on('dechiffrerCles', handler=self.requete_dechiffrer_cles)
        # self._sio.on('majConfigurationUsager', handler=self.maj_configuration_usager)

        self._sio.on('ecouterEvenementsMessagesUsager', handler=self.ecouter_messages_usager)
        self._sio.on('retirerEvenementsMessagesUsager', handler=self.retirer_messages_usager)

    @property
    def exchange_default(self):
        return ConstantesMessages.EXCHANGE_DEFAUT

    async def requete_sync_messages(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessages.NOM_DOMAINE, 'syncMessages')

    async def requete_messages_par_ids(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessages.NOM_DOMAINE, 'getMessagesParIds')

    async def requete_dechiffrer_cles(self, sid: str, message: dict):
        return await self.executer_requete(sid, message,
                                           ConstantesMessages.NOM_DOMAINE, 'dechiffrerCles')

    async def maj_configuration_usager(self, sid: str, message: dict):
        return await self.executer_commande(sid, message,
                                            ConstantesMessages.NOM_DOMAINE, 'majConfigurationUsager')

    # Listeners

    async def ecouter_messages_usager(self, sid: str, message: dict):
        # "ecouterEvenementsMessagesUsager"
        async with self._sio.session(sid) as session:
            try:
                enveloppe = await self.authentifier_message(session, message)
                user_id = enveloppe.get_user_id
            except ErreurAuthentificationMessage as e:
                return self.etat.formatteur_message.signer_message(
                    Constantes.KIND_REPONSE, {'ok': False, 'err': str(e)})[0]

        exchanges = [Constantes.SECURITE_PRIVE]
        routing_keys = [
            f'evenement.Messages.{user_id}.nouveauMessage',
            f'evenement.Messages.{user_id}.messageLu',
            f'evenement.Messages.{user_id}.messageSupprime',
        ]

        reponse = await self.subscribe(sid, message, routing_keys, exchanges, enveloppe=enveloppe)
        reponse_signee, correlation_id = self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, reponse)

        return reponse_signee

    async def retirer_messages_usager(self, sid: str, message: dict):
        # "retirerEvenementsMessagesUsager"
        async with self._sio.session(sid) as session:
            try:
                enveloppe = await self.authentifier_message(session, message)
                user_id = enveloppe.get_user_id
            except (CertificatInconnu, ErreurAuthentificationMessage) as e:
                return self.etat.formatteur_message.signer_message(
                    Constantes.KIND_REPONSE, {'ok': False, 'err': str(e)})[0]

        exchanges = [Constantes.SECURITE_PRIVE]
        routing_keys = [
            f'evenement.Messages.{user_id}.nouveauMessage',
            f'evenement.Messages.{user_id}.messageLu',
            f'evenement.Messages.{user_id}.messageSupprime',
        ]

        reponse = await self.unsubscribe(sid, message, routing_keys, exchanges)
        reponse_signee, correlation_id = self.etat.formatteur_message.signer_message(Constantes.KIND_REPONSE, reponse)

        return reponse_signee
